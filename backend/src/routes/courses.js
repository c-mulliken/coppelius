const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /courses - List all courses with optional filters
router.get('/', (req, res) => {
  const { search, department } = req.query;
  let sql = `
    SELECT c.id, c.code, c.title, c.department
    FROM courses c
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += ` AND (c.code LIKE ? OR c.title LIKE ?)`;
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

module.exports = router;
