const axios = require('axios');
const db = require('../config/database');

const CAB_API_URL = process.env.CAB_API_URL || 'https://cab.brown.edu/api/';

// Semesters since 2019 (format: YYYYSS where SS is 10=Fall, 20=Spring)
const SEMESTERS = [
  '201910', '202010', '202020', '202110', '202120',
  '202210', '202220', '202310', '202320', '202410',
  '202420', '202510', '202520'
];

async function scrapeSemester(semester) {
  console.log(`Scraping semester ${semester}...`);

  const params = {
    page: 'fose',
    route: 'search',
    is_ind_study: 'N',
    is_canc: 'N'
  };

  const payload = {
    other: {
      srcdb: semester
    },
    criteria: [
      { field: 'is_ind_study', value: 'N' },
      { field: 'is_canc', value: 'N' }
    ]
  };

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  };

  try {
    const response = await axios.post(CAB_API_URL, payload, { params, headers });

    if (response.status === 200 && response.data.results) {
      const results = response.data.results;
      console.log(`Found ${results.length} course offerings for semester ${semester}`);

      // Insert courses and offerings into database
      let insertedCourses = 0;
      let insertedOfferings = 0;

      for (const item of results) {
        try {
          const courseId = await ensureCourse(item);
          await insertOffering(item, courseId, semester);
          insertedOfferings++;
        } catch (err) {
          // Ignore duplicate entries
          if (!err.message.includes('UNIQUE constraint')) {
            console.error(`Error inserting ${item.code}:`, err.message);
          }
        }
      }

      console.log(`Inserted offerings for semester ${semester}`);
      return insertedOfferings;
    }
  } catch (error) {
    console.error(`Error scraping semester ${semester}:`, error.message);
    return 0;
  }
}

// Ensure course exists in courses table, return course_id
function ensureCourse(item) {
  return new Promise((resolve, reject) => {
    const department = item.code.split(' ')[0];

    // First, try to find existing course
    const findSql = `SELECT id FROM courses WHERE code = ?`;

    db.get(findSql, [item.code], (err, row) => {
      if (err) {
        return reject(err);
      }

      if (row) {
        // Course already exists
        return resolve(row.id);
      }

      // Insert new course
      const insertSql = `
        INSERT INTO courses (code, title, department)
        VALUES (?, ?, ?)
      `;

      db.run(insertSql, [item.code, item.title, department], function(err) {
        if (err) {
          // Handle race condition where another process inserted the same course
          if (err.message.includes('UNIQUE constraint')) {
            db.get(findSql, [item.code], (err2, row2) => {
              if (err2) return reject(err2);
              resolve(row2.id);
            });
          } else {
            reject(err);
          }
        } else {
          resolve(this.lastID);
        }
      });
    });
  });
}

// Insert offering
function insertOffering(item, courseId, semester) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO offerings (course_id, professor, semester, section, crn, srcdb, meeting_times)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
      sql,
      [
        courseId,
        item.instr || 'TBD',
        semester,
        item.no || null,
        item.crn,
        item.srcdb,
        item.meets || ''
      ],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

async function scrapeAllSemesters() {
  console.log('Starting course scraping...');
  let totalInserted = 0;

  for (const semester of SEMESTERS) {
    const inserted = await scrapeSemester(semester);
    totalInserted += inserted;

    // Add delay to be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\nScraping complete! Total offerings inserted: ${totalInserted}`);

  // Close database connection
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed');
  });
}

// Run if called directly
if (require.main === module) {
  scrapeAllSemesters();
}

module.exports = { scrapeAllSemesters, scrapeSemester };
