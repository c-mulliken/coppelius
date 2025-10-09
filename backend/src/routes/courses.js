const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { getSuggestedCourses } = require('../services/courseSuggestionService');

// GET /courses - List all courses with optional filters
router.get('/', async (req, res) => {
  const { search, department } = req.query;

  // For PostgreSQL with fuzzy matching
  if (db.pool && search) {
    try {
      let sql = `
        SELECT c.id, c.code, c.title, c.department,
               similarity(LOWER(c.code || ' ' || c.title), LOWER($1)) as similarity_score
        FROM courses c
        WHERE 1=1
      `;
      const params = [search];
      let paramIndex = 2;

      // Use fuzzy matching with trigram similarity
      sql += ` AND (
        LOWER(c.code) LIKE LOWER($${paramIndex}) OR
        LOWER(c.title) LIKE LOWER($${paramIndex + 1}) OR
        similarity(LOWER(c.code || ' ' || c.title), LOWER($1)) > 0.1
      )`;
      params.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;

      if (department) {
        sql += ` AND c.department = $${paramIndex}`;
        params.push(department);
      }

      // Order by similarity score for fuzzy matches, then by code
      sql += ` ORDER BY similarity_score DESC, c.code LIMIT 100`;

      const result = await db.pool.query(sql, params);
      return res.json(result.rows);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Fallback for SQLite or non-search queries (case-insensitive)
  let sql = `
    SELECT c.id, c.code, c.title, c.department
    FROM courses c
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += ` AND (LOWER(c.code) LIKE LOWER(?) OR LOWER(c.title) LIKE LOWER(?))`;
    params.push(`%${search}%`, `%${search}%`);
  }

  if (department) {
    sql += ` AND c.department = ?`;
    params.push(department);
  }

  sql += ` ORDER BY c.code LIMIT 100`;

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// GET /courses/:id - Get course details
router.get('/:id', (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT id, code, title, department, description
    FROM courses
    WHERE id = ?
  `;

  db.get(sql, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!row) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(row);
  });
});

// GET /courses/:id/offerings - List all offerings for a course
router.get('/:id/offerings', (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT
      o.id,
      o.professor,
      o.semester,
      o.section,
      o.meeting_times,
      COALESCE(r.rating, 1500) as rating,
      COALESCE(r.comparison_count, 0) as comparison_count
    FROM offerings o
    LEFT JOIN offering_ratings r ON o.id = r.offering_id
    WHERE o.course_id = ?
    ORDER BY o.semester DESC, o.section
  `;

  db.all(sql, [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// GET /courses/suggestions - Get suggested courses for user
router.get('/suggestions/for-user', (req, res) => {
  const userId = req.query.user_id;
  const limit = parseInt(req.query.limit) || 4;

  getSuggestedCourses(userId, limit, (err, courses) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(courses);
  });
});

module.exports = router;
