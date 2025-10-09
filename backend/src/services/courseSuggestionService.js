const db = require('../config/db');

/**
 * Get suggested courses for a user
 *
 * Strategy (abstracted for easy future enhancement):
 * - Currently: Popular courses (most added by users)
 * - Future: Can be enhanced to use collaborative filtering, department matching,
 *   personalized recommendations based on user's existing courses, etc.
 *
 * @param {number} userId - The user ID
 * @param {number} limit - Number of suggestions to return (default: 4)
 * @param {function} callback - Callback function (err, suggestions)
 */
function getSuggestedCourses(userId, limit = 4, callback) {
  // Currently using popularity-based recommendations
  // Easy to swap: getRandomCourses, getSimilarCourses, or build custom logic
  return getPopularCourses(limit, callback);
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
 * Returns courses with the most user additions, excluding courses with no offerings
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
    ORDER BY
      user_count DESC,
      offering_count DESC,
      c.code ASC
    LIMIT ?
  `;

  db.all(sql, [limit], (err, courses) => {
    if (err) return callback(err);

    // If we don't have enough popular courses (new database), fall back to random
    if (!courses || courses.length < limit) {
      return getRandomCourses(limit, callback);
    }

    callback(null, courses);
  });
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
