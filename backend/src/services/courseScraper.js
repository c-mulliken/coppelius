const axios = require('axios');
const db = require('../config/db');
const { fetchCourseDescription } = require('./cabApiService');

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
    console.log(`Making request to CAB API for semester ${semester}...`);
    const response = await axios.post(CAB_API_URL, payload, { params, headers });

    console.log(`Response status: ${response.status}`);
    console.log(`Response has data: ${!!response.data}`);
    console.log(`Response has results: ${!!response.data?.results}`);

    if (response.status === 200 && response.data.results) {
      const results = response.data.results;
      console.log(`Found ${results.length} course offerings for semester ${semester}`);

      // Filter out conference sections (sections starting with 'C')
      const filteredResults = results.filter(item => {
        const section = item.no || '';
        if (section.startsWith('C')) {
          console.log(`Skipping conference section: ${item.code} ${section}`);
          return false;
        }
        return true;
      });

      console.log(`Processing ${filteredResults.length} non-conference offerings (skipped ${results.length - filteredResults.length} conference sections)`);

      // Insert courses and offerings into database
      let insertedCourses = 0;
      let insertedOfferings = 0;

      for (const item of filteredResults) {
        try {
          const courseId = await ensureCourse(item);
          await insertOffering(item, courseId, semester);
          insertedOfferings++;

          // Delay to avoid overwhelming CAB API when fetching descriptions
          // Rate limit: ~2 requests/second to be respectful
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          // Ignore duplicate entries
          if (!err.message.includes('UNIQUE constraint')) {
            console.error(`Error inserting ${item.code}:`, err.message);
          }
        }
      }

      console.log(`Inserted offerings for semester ${semester}`);
      return insertedOfferings;
    } else {
      console.log(`No results returned for semester ${semester}`);
      console.log(`Response data:`, JSON.stringify(response.data, null, 2));
      return 0;
    }
  } catch (error) {
    console.error(`Error scraping semester ${semester}:`, error.message);
    console.error('Full error:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    return 0;
  }
}

// Ensure course exists in courses table, return course_id
async function ensureCourse(item) {
  return new Promise(async (resolve, reject) => {
    const department = item.code.split(' ')[0];

    // First, try to find existing course
    const findSql = `SELECT id, description FROM courses WHERE code = ?`;

    db.get(findSql, [item.code], async (err, row) => {
      if (err) {
        return reject(err);
      }

      if (row) {
        // Course exists, check if we need to fetch description
        if (!row.description && item.crn && item.srcdb) {
          console.log(`Fetching description for ${item.code}...`);
          const description = await fetchCourseDescription(item.crn, item.code, item.srcdb);
          if (description) {
            const updateSql = `UPDATE courses SET description = ? WHERE id = ?`;
            db.run(updateSql, [description, row.id], (err) => {
              if (err) console.error(`Error updating description for ${item.code}:`, err.message);
            });
          }
        }
        return resolve(row.id);
      }

      // Fetch description for new course
      let description = null;
      if (item.crn && item.srcdb) {
        console.log(`Fetching description for new course ${item.code}...`);
        description = await fetchCourseDescription(item.crn, item.code, item.srcdb);
      }

      // Insert new course
      const insertSql = `
        INSERT INTO courses (code, title, department, description)
        VALUES (?, ?, ?, ?)
      `;

      db.run(insertSql, [item.code, item.title, department, description], function(err) {
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
  console.log('Note: Description fetching is rate-limited to avoid overwhelming CAB API');
  let totalInserted = 0;

  for (const semester of SEMESTERS) {
    const inserted = await scrapeSemester(semester);
    totalInserted += inserted;

    // Add delay to be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\nScraping complete! Total offerings inserted: ${totalInserted}`);

  // Close database connection (only if SQLite, PostgreSQL pool stays open)
  if (db.close && typeof db.close === 'function') {
    db.close((err) => {
      if (err) {
        console.error(err.message);
      }
      console.log('Database connection closed');
    });
  } else {
    console.log('PostgreSQL pool connection remains open');
    process.exit(0); // Exit cleanly
  }
}

// Run if called directly
if (require.main === module) {
  scrapeAllSemesters();
}

module.exports = { scrapeAllSemesters, scrapeSemester };
