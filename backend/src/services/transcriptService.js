const db = require('../config/db');
const { parseTranscriptWithTerms } = require('./transcriptParser');

/**
 * Find or create a course in the database
 * @param {Object} courseData - Parsed course data
 * @returns {Promise<number>} Course ID
 */
function ensureCourse(courseData) {
  return new Promise((resolve, reject) => {
    const { code, title, department } = courseData;

    // First, try to find existing course
    const findSql = `SELECT id FROM courses WHERE code = ?`;

    db.get(findSql, [code], (err, row) => {
      if (err) {
        return reject(err);
      }

      if (row) {
        return resolve(row.id);
      }

      // Insert new course
      const insertSql = `
        INSERT INTO courses (code, title, department)
        VALUES (?, ?, ?)
      `;

      db.run(insertSql, [code, title, department], function(err) {
        if (err) {
          // Handle race condition where another process inserted the same course
          if (err.message.includes('UNIQUE constraint')) {
            db.get(findSql, [code], (err2, row2) => {
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

/**
 * Find or create an offering in the database
 * @param {number} courseId - Course ID
 * @param {Object} courseData - Parsed course data with semester and section
 * @returns {Promise<number>} Offering ID
 */
function ensureOffering(courseId, courseData) {
  return new Promise((resolve, reject) => {
    const { semester, section } = courseData;

    // Transcripts don't include professor info, so we'll try to find an existing offering
    // that matches course_id, semester, and section
    const findSql = `
      SELECT id FROM offerings
      WHERE course_id = ? AND semester = ? AND section = ?
      LIMIT 1
    `;

    db.get(findSql, [courseId, semester, section], (err, row) => {
      if (err) {
        return reject(err);
      }

      if (row) {
        return resolve(row.id);
      }

      // If no exact match, try to find any offering for that course and semester
      const findAnySql = `
        SELECT id FROM offerings
        WHERE course_id = ? AND semester = ?
        LIMIT 1
      `;

      db.get(findAnySql, [courseId, semester], (err2, row2) => {
        if (err2) {
          return reject(err2);
        }

        if (row2) {
          return resolve(row2.id);
        }

        // Create a new offering with unknown professor
        const insertSql = `
          INSERT INTO offerings (course_id, professor, semester, section)
          VALUES (?, ?, ?, ?)
        `;

        db.run(insertSql, [courseId, 'Unknown', semester, section], function(err3) {
          if (err3) {
            // Handle race condition
            if (err3.message.includes('UNIQUE constraint')) {
              db.get(findSql, [courseId, semester, section], (err4, row3) => {
                if (err4) return reject(err4);
                resolve(row3.id);
              });
            } else {
              reject(err3);
            }
          } else {
            resolve(this.lastID);
          }
        });
      });
    });
  });
}

/**
 * Add a course offering to a user's course list
 * @param {number} userId - User ID
 * @param {number} offeringId - Offering ID
 * @returns {Promise<void>}
 */
function addUserCourse(userId, offeringId) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO user_courses (user_id, offering_id)
      VALUES (?, ?)
      ON CONFLICT(user_id, offering_id) DO NOTHING
    `;

    db.run(sql, [userId, offeringId], function(err) {
      if (err) {
        // Ignore duplicate entries
        if (err.message.includes('UNIQUE constraint')) {
          return resolve();
        }
        return reject(err);
      }
      resolve();
    });
  });
}

/**
 * Process transcript and add all courses to user's profile
 * @param {number} userId - User ID
 * @param {string} htmlContent - HTML content of transcript
 * @returns {Promise<Object>} Summary of import results
 */
async function importTranscript(userId, htmlContent) {
  try {
    const courses = parseTranscriptWithTerms(htmlContent);

    const results = {
      total: courses.length,
      added: 0,
      skipped: 0,
      errors: []
    };

    for (const courseData of courses) {
      try {
        // Skip courses without semester info (like AP credits with no semester)
        if (!courseData.semester) {
          console.log(`Skipping ${courseData.code} - no semester info`);
          results.skipped++;
          continue;
        }

        // Skip courses with grade "T" (transfer credit) or no grade
        if (!courseData.grade || courseData.grade === 'T') {
          console.log(`Skipping ${courseData.code} - transfer/no grade`);
          results.skipped++;
          continue;
        }

        // Ensure course exists
        const courseId = await ensureCourse(courseData);

        // Ensure offering exists
        const offeringId = await ensureOffering(courseId, courseData);

        // Add to user's courses
        await addUserCourse(userId, offeringId);

        console.log(`Added ${courseData.code} (${courseData.semester}) to user ${userId}`);
        results.added++;
      } catch (err) {
        console.error(`Error processing ${courseData.code}:`, err.message);
        results.errors.push({
          course: courseData.code,
          error: err.message
        });
      }
    }

    return results;
  } catch (err) {
    throw new Error(`Failed to parse transcript: ${err.message}`);
  }
}

module.exports = {
  ensureCourse,
  ensureOffering,
  addUserCourse,
  importTranscript
};
