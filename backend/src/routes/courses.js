const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { getSuggestedCourses } = require('../services/courseSuggestionService');

// GET /courses/rankings - Get all offerings with global ratings for rankings page
router.get('/rankings', async (req, res) => {
  const { search, department, professor, sort = 'rating' } = req.query;

  if (!db.pool) {
    return res.status(500).json({ error: 'PostgreSQL connection required' });
  }

  try {
    let sql = `
      SELECT
        o.id as offering_id,
        c.id as course_id,
        c.code,
        c.title,
        c.department,
        o.professor,
        o.semester,
        r.rating,
        COALESCE(comp_count.count, 0) as comparison_count
      FROM offerings o
      JOIN courses c ON o.course_id = c.id
      INNER JOIN offering_ratings r ON o.id = r.offering_id AND r.category = 'enjoyment'
      LEFT JOIN (
        SELECT offering_id, COUNT(*) as count
        FROM (
          SELECT offering_a_id as offering_id FROM comparisons WHERE category = 'enjoyment'
          UNION ALL
          SELECT offering_b_id as offering_id FROM comparisons WHERE category = 'enjoyment'
        ) all_comps
        GROUP BY offering_id
      ) comp_count ON o.id = comp_count.offering_id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (search) {
      sql += ` AND (
        LOWER(c.code) LIKE LOWER($${paramIndex}) OR
        LOWER(c.title) LIKE LOWER($${paramIndex + 1})
      )`;
      params.push(`%${search}%`, `%${search}%`);
      paramIndex += 2;
    }

    if (department) {
      sql += ` AND c.department = $${paramIndex}`;
      params.push(department);
      paramIndex++;
    }

    if (professor) {
      sql += ` AND LOWER(o.professor) LIKE LOWER($${paramIndex})`;
      params.push(`%${professor}%`);
      paramIndex++;
    }

    // Sorting
    if (sort === 'rating') {
      sql += ` ORDER BY rating DESC, comparison_count DESC`;
    } else if (sort === 'comparisons') {
      sql += ` ORDER BY comparison_count DESC, rating DESC`;
    } else if (sort === 'code') {
      sql += ` ORDER BY c.code ASC`;
    }

    sql += ` LIMIT 500`;

    const result = await db.pool.query(sql, params);
    console.log('\n=== RANKINGS QUERY ===');
    console.log('Total offerings returned:', result.rows.length);
    console.log('First 5 offerings:', result.rows.slice(0, 5).map(r => ({
      code: r.code,
      professor: r.professor,
      rating: r.rating,
      comparison_count: r.comparison_count
    })));
    console.log('Lowest ratings:', result.rows.slice(-5).map(r => ({
      code: r.code,
      professor: r.professor,
      rating: r.rating,
      comparison_count: r.comparison_count
    })));
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rankings:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /courses - List all courses with optional filters
router.get('/', async (req, res) => {
  const { search, department } = req.query;

  // PostgreSQL with fuzzy search
  if (db.pool) {
    try {
      let sql = `
        SELECT c.id, c.code, c.title, c.department
      `;
      const params = [];
      let paramIndex = 1;

      // Add similarity score for fuzzy matching when searching
      if (search) {
        sql += `, similarity(LOWER(c.code || ' ' || c.title), LOWER($${paramIndex})) as similarity_score`;
        params.push(search);
        paramIndex++;
      }

      sql += `
        FROM courses c
        WHERE 1=1
      `;

      if (search) {
        sql += ` AND (
          LOWER(c.code) LIKE LOWER($${paramIndex}) OR
          LOWER(c.title) LIKE LOWER($${paramIndex + 1}) OR
          similarity(LOWER(c.code || ' ' || c.title), LOWER($${paramIndex + 2})) > 0.1
        )`;
        params.push(`%${search}%`, `%${search}%`, search);
        paramIndex += 3;
      }

      if (department) {
        sql += ` AND c.department = $${paramIndex}`;
        params.push(department);
      }

      // Order by similarity score if searching, otherwise by code
      if (search) {
        sql += ` ORDER BY similarity_score DESC, c.code LIMIT 100`;
      } else {
        sql += ` ORDER BY c.code LIMIT 100`;
      }

      const result = await db.pool.query(sql, params);
      return res.json(result.rows);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Fallback for SQLite (case-insensitive)
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
