const db = require('../config/db');

/**
 * Get suggested courses for a user
 *
 * Strategy (abstracted for easy future enhancement):
 * - Currently: Random sampling from course database
 * - Future: Can be enhanced to use collaborative filtering, popularity ranking,
 *   department matching, etc.
 *
 * @param {number} userId - The user ID
 * @param {number} limit - Number of suggestions to return (default: 4)
 * @param {function} callback - Callback function (err, suggestions)
 */
function getSuggestedCourses(userId, limit = 4, callback) {
  // For now, implement random sampling
  // Future: Replace this with intelligent recommendation logic
  return getRandomCourses(limit, callback);
}

/**
 * Get random courses from the database
 * @param {number} limit - Number of courses to return
 * @param {function} callback - Callback function (err, courses)
 */
function getRandomCourses(limit, callback) {
  const sql = `
    SELECT
      c.id,
      c.code,
      c.title,
      c.department,
      COUNT(DISTINCT o.id) as offering_count
    FROM courses c
    JOIN offerings o ON c.id = o.course_id
    GROUP BY c.id, c.code, c.title, c.department
    HAVING COUNT(DISTINCT o.id) > 0
    ORDER BY RANDOM()
    LIMIT ?
  `;

  db.all(sql, [limit], callback);
}

/**
 * Get popular courses based on how many users have added them
 * (Placeholder for future enhancement)
 * @param {number} limit - Number of courses to return
 * @param {function} callback - Callback function (err, courses)
 */
function getPopularCourses(limit, callback) {
  const sql = `
    SELECT
      c.id,
      c.code,
      c.title,
      c.department,
      COUNT(DISTINCT uc.user_id) as user_count,
      COUNT(DISTINCT o.id) as offering_count
    FROM courses c
    JOIN offerings o ON c.id = o.course_id
    LEFT JOIN user_courses uc ON o.id = uc.offering_id
    GROUP BY c.id, c.code, c.title, c.department
    HAVING COUNT(DISTINCT o.id) > 0
    ORDER BY user_count DESC, c.code
    LIMIT ?
  `;

  db.all(sql, [limit], callback);
}

/**
 * Get courses similar to what the user has already added
 * (Placeholder for future enhancement - can use department, level, etc.)
 * @param {number} userId - The user ID
 * @param {number} limit - Number of courses to return
 * @param {function} callback - Callback function (err, courses)
 */
function getSimilarCourses(userId, limit, callback) {
  // Future: Implement collaborative filtering or content-based filtering
  // For now, fall back to random
  return getRandomCourses(limit, callback);
}

module.exports = {
  getSuggestedCourses,
  getRandomCourses,
  getPopularCourses,
  getSimilarCourses
};
