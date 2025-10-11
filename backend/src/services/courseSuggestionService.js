const db = require('../config/db');

/**
 * Get suggested courses for a user
 *
 * Strategy:
 * - Uses semantic similarity via pgvector embeddings
 * - Recommends courses similar to what the user has already added
 * - Falls back to popular courses if embeddings unavailable
 *
 * @param {number} userId - The user ID
 * @param {number} limit - Number of suggestions to return (default: 4)
 * @param {function} callback - Callback function (err, suggestions)
 */
function getSuggestedCourses(userId, limit = 4, callback) {
  // Use semantic similarity based on user's existing courses
  return getSimilarCourses(userId, limit, callback);
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
 * Uses pgvector embeddings for semantic similarity
 * @param {number} userId - The user ID
 * @param {number} limit - Number of courses to return
 * @param {function} callback - Callback function (err, courses)
 */
async function getSimilarCourses(userId, limit, callback) {
  // Only works with PostgreSQL + pgvector
  if (!db.pool) {
    return getRandomCourses(limit, callback);
  }

  try {
    // Get ALL of the user's current courses (including those without embeddings)
    const allUserCoursesResult = await db.pool.query(`
      SELECT DISTINCT c.id
      FROM user_courses uc
      JOIN offerings o ON uc.offering_id = o.id
      JOIN courses c ON o.course_id = c.id
      WHERE uc.user_id = $1
    `, [userId]);

    const allUserCourseIds = allUserCoursesResult.rows.map(c => c.id);

    // Get the user's courses that have embeddings for similarity calculation
    const userCoursesResult = await db.pool.query(`
      SELECT DISTINCT c.id, c.embedding
      FROM user_courses uc
      JOIN offerings o ON uc.offering_id = o.id
      JOIN courses c ON o.course_id = c.id
      WHERE uc.user_id = $1 AND c.embedding IS NOT NULL
    `, [userId]);

    const userCourses = userCoursesResult.rows;

    // If user has no courses with embeddings, fall back to random
    if (userCourses.length === 0) {
      return getRandomCourses(limit, callback);
    }

    // Average the embeddings of user's courses
    // pgvector supports vector operations
    const embeddingsList = userCourses.map(c => `'${JSON.stringify(c.embedding)}'::vector`).join(' + ');
    const avgEmbedding = `(${embeddingsList}) / ${userCourses.length}`;

    // Fetch top K similar courses (K = limit * 5 for diversity)
    const topK = limit * 5;

    // Find similar courses using cosine similarity
    const sql = `
      SELECT
        c.id,
        c.code,
        c.title,
        c.department,
        COUNT(DISTINCT o.id) as offering_count,
        1 - (c.embedding <=> (${avgEmbedding})) as similarity
      FROM courses c
      JOIN offerings o ON c.id = o.course_id
      WHERE c.embedding IS NOT NULL
        AND c.id != ALL($1::int[])
      GROUP BY c.id, c.code, c.title, c.department, c.embedding
      HAVING COUNT(DISTINCT o.id) > 0
      ORDER BY c.embedding <=> (${avgEmbedding})
      LIMIT $2
    `;

    const result = await db.pool.query(sql, [allUserCourseIds, topK]);

    // Randomly sample 'limit' courses from the top K results for diversity
    const topKCourses = result.rows;
    const sampledCourses = [];
    const indices = [...Array(topKCourses.length).keys()];

    // Fisher-Yates shuffle and take first 'limit' items
    for (let i = indices.length - 1; i > 0 && sampledCourses.length < limit; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
      sampledCourses.push(topKCourses[indices[i]]);
    }

    // Handle case where topK < limit
    if (sampledCourses.length < limit && topKCourses.length > 0) {
      for (let i = 0; i < topKCourses.length && sampledCourses.length < limit; i++) {
        if (!sampledCourses.includes(topKCourses[i])) {
          sampledCourses.push(topKCourses[i]);
        }
      }
    }

    callback(null, sampledCourses);
  } catch (error) {
    console.error('Error getting similar courses:', error);
    // Fall back to random on error
    return getRandomCourses(limit, callback);
  }
}

module.exports = {
  getSuggestedCourses,
  getRandomCourses,
  getPopularCourses,
  getSimilarCourses
};
