const db = require('../config/db');
const { parseTranscriptWithTerms } = require('./transcriptParser');

/**
 * Find a course in the database (does NOT create if not found)
 * @param {Object} courseData - Parsed course data
 * @returns {Promise<number|null>} Course ID or null if not found
 */
function findCourse(courseData) {
  return new Promise((resolve, reject) => {
    const { code } = courseData;

    // Only find existing course - don't create new ones
    const findSql = `SELECT id FROM courses WHERE code = ?`;

    db.get(findSql, [code], (err, row) => {
      if (err) {
        return reject(err);
      }

      // Return course ID if found, null otherwise
      resolve(row ? row.id : null);
    });
  });
}

/**
 * Find an offering in the database (does NOT create if not found)
 * @param {number} courseId - Course ID
 * @param {Object} courseData - Parsed course data with semester and section
 * @returns {Promise<number|null>} Offering ID or null if not found
 */
function findOffering(courseId, courseData) {
  return new Promise((resolve, reject) => {
    const { semester, section } = courseData;

    // Try to find an exact match (course_id, semester, and section)
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

        // Return offering ID if found, null otherwise
        resolve(row2 ? row2.id : null);
      });
    });
  });
}

/**
 * Add a course offering to a user's course list
 * @param {number} userId - User ID
 * @param {number} offeringId - Offering ID
 * @param {string} grade - Grade received (optional)
 * @returns {Promise<void>}
 */
function addUserCourse(userId, offeringId, grade = null) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO user_courses (user_id, offering_id, grade)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, offering_id) DO UPDATE SET grade = EXCLUDED.grade
    `;

    db.run(sql, [userId, offeringId, grade], function(err) {
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

        // Find course (don't create if not exists)
        const courseId = await findCourse(courseData);

        if (!courseId) {
          console.log(`Skipping ${courseData.code} - not in database`);
          results.skipped++;
          continue;
        }

        // Find offering (don't create if not exists)
        const offeringId = await findOffering(courseId, courseData);

        if (!offeringId) {
          console.log(`Skipping ${courseData.code} (${courseData.semester}) - offering not in database`);
          results.skipped++;
          continue;
        }

        // Add to user's courses with grade
        await addUserCourse(userId, offeringId, courseData.grade);

        console.log(`Added ${courseData.code} (${courseData.semester}) with grade ${courseData.grade} to user ${userId}`);
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
  findCourse,
  findOffering,
  addUserCourse,
  importTranscript
};
