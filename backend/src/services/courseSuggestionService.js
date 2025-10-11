const db = require('../config/db');

/**
 * Perform k-means clustering on course embeddings
 * @param {Array} embeddings - Array of {id, embedding} objects
 * @param {number} k - Number of clusters
 * @returns {Array} Array of clusters, each containing course IDs and centroid
 */
function kMeansClustering(embeddings, k) {
  if (embeddings.length <= k) {
    // If we have fewer courses than clusters, each course is its own cluster
    return embeddings.map(e => ({
      courses: [e.id],
      centroid: e.embedding
    }));
  }

  const dim = embeddings[0].embedding.length;

  // Initialize centroids randomly from existing embeddings
  const centroids = [];
  const shuffled = [...embeddings].sort(() => Math.random() - 0.5);
  for (let i = 0; i < k; i++) {
    centroids.push([...shuffled[i].embedding]);
  }

  let assignments = new Array(embeddings.length);
  let changed = true;
  let iterations = 0;
  const maxIterations = 100;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // Assign each embedding to nearest centroid
    for (let i = 0; i < embeddings.length; i++) {
      let minDist = Infinity;
      let bestCluster = 0;

      for (let j = 0; j < k; j++) {
        const dist = cosineSimilarity(embeddings[i].embedding, centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = j;
        }
      }

      if (assignments[i] !== bestCluster) {
        changed = true;
        assignments[i] = bestCluster;
      }
    }

    // Update centroids
    for (let j = 0; j < k; j++) {
      const clusterPoints = embeddings.filter((_, i) => assignments[i] === j);
      if (clusterPoints.length > 0) {
        // Average the embeddings in this cluster
        const newCentroid = new Array(dim).fill(0);
        for (const point of clusterPoints) {
          for (let d = 0; d < dim; d++) {
            newCentroid[d] += point.embedding[d];
          }
        }
        for (let d = 0; d < dim; d++) {
          newCentroid[d] /= clusterPoints.length;
        }
        centroids[j] = newCentroid;
      }
    }
  }

  // Build clusters
  const clusters = [];
  for (let j = 0; j < k; j++) {
    const clusterCourses = embeddings
      .filter((_, i) => assignments[i] === j)
      .map(e => e.id);

    if (clusterCourses.length > 0) {
      clusters.push({
        courses: clusterCourses,
        centroid: centroids[j]
      });
    }
  }

  return clusters;
}

/**
 * Calculate cosine distance (1 - cosine similarity) between two vectors
 * @param {Array} a - First vector
 * @param {Array} b - Second vector
 * @returns {number} Cosine distance
 */
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return 1 - similarity; // Return distance, not similarity
}

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
 * Uses k-means clustering + pgvector embeddings for semantic similarity
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

    // Determine number of clusters (roughly 5 courses per cluster)
    const k = Math.max(1, Math.ceil(userCourses.length / 5));

    // Perform k-means clustering on user's courses
    const clusters = kMeansClustering(userCourses, k);

    // Number of recommendations per cluster
    const perCluster = Math.max(2, Math.ceil(limit / clusters.length));
    const topKPerCluster = perCluster * 3; // Fetch 3x for diversity

    // Query similar courses for each cluster
    const allRecommendations = [];

    for (const cluster of clusters) {
      const centroid = cluster.centroid;
      const centroidVector = `'${JSON.stringify(centroid)}'::vector`;

      const sql = `
        SELECT
          c.id,
          c.code,
          c.title,
          c.department,
          COUNT(DISTINCT o.id) as offering_count,
          1 - (c.embedding <=> ${centroidVector}) as similarity
        FROM courses c
        JOIN offerings o ON c.id = o.course_id
        WHERE c.embedding IS NOT NULL
          AND c.id != ALL($1::int[])
        GROUP BY c.id, c.code, c.title, c.department, c.embedding
        HAVING COUNT(DISTINCT o.id) > 0
        ORDER BY c.embedding <=> ${centroidVector}
        LIMIT $2
      `;

      const result = await db.pool.query(sql, [allUserCourseIds, topKPerCluster]);
      allRecommendations.push(...result.rows);
    }

    // Remove duplicates (a course might be similar to multiple clusters)
    const uniqueCourses = [];
    const seenIds = new Set();

    for (const course of allRecommendations) {
      if (!seenIds.has(course.id)) {
        seenIds.add(course.id);
        uniqueCourses.push(course);
      }
    }

    // Randomly sample 'limit' courses from all recommendations for diversity
    const sampledCourses = [];
    const indices = [...Array(uniqueCourses.length).keys()];

    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Take first 'limit' items
    for (let i = 0; i < Math.min(limit, uniqueCourses.length); i++) {
      sampledCourses.push(uniqueCourses[indices[i]]);
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
