const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Create a new user
router.post('/', (req, res) => {
  const sql = `INSERT INTO users DEFAULT VALUES`;

  db.run(sql, function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.status(201).json({
      id: this.lastID,
      created_at: new Date().toISOString()
    });
  });
});

// Get user profile
router.get('/:id', (req, res) => {
  const { id } = req.params;

  const sql = `SELECT id, created_at FROM users WHERE id = ?`;

  db.get(sql, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(row);
  });
});

// Get all course offerings for a user
router.get('/:id/courses', (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT
      o.id as offering_id,
      c.id as course_id,
      c.code,
      c.title,
      c.department,
      o.professor,
      o.semester,
      o.section,
      uc.added_at
    FROM user_courses uc
    JOIN offerings o ON uc.offering_id = o.id
    JOIN courses c ON o.course_id = c.id
    WHERE uc.user_id = ?
    ORDER BY uc.added_at DESC
  `;

  db.all(sql, [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get user's ranked courses based on comparisons
router.get('/:id/rankings', (req, res) => {
  const { id } = req.params;

  const sql = `
    WITH user_offerings AS (
      SELECT uc.offering_id
      FROM user_courses uc
      WHERE uc.user_id = ?
    ),
    offering_stats AS (
      SELECT
        o.id as offering_id,
        c.code,
        c.title,
        o.professor,
        o.semester,
        COALESCE(r.rating, 1500) as rating,
        COUNT(CASE WHEN comp.winner_offering_id = o.id THEN 1 END) as wins,
        COUNT(CASE WHEN comp.winner_offering_id != o.id AND (comp.offering_a_id = o.id OR comp.offering_b_id = o.id) THEN 1 END) as losses,
        COUNT(CASE WHEN comp.offering_a_id = o.id OR comp.offering_b_id = o.id THEN 1 END) as total_comparisons
      FROM user_offerings uo
      JOIN offerings o ON uo.offering_id = o.id
      JOIN courses c ON o.course_id = c.id
      LEFT JOIN offering_ratings r ON o.id = r.offering_id
      LEFT JOIN comparisons comp ON (comp.offering_a_id = o.id OR comp.offering_b_id = o.id) AND comp.user_id = ?
      GROUP BY o.id, c.code, c.title, o.professor, o.semester, r.rating
    )
    SELECT
      offering_id,
      code,
      title,
      professor,
      semester,
      rating,
      wins,
      losses,
      total_comparisons,
      ROUND(CASE WHEN total_comparisons > 0 THEN (wins * 100.0 / total_comparisons) ELSE 0 END, 1) as win_rate
    FROM offering_stats
    WHERE total_comparisons > 0
    ORDER BY rating DESC, wins DESC
  `;

  db.all(sql, [id, id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Add a course offering to user's list
router.post('/:id/courses', (req, res) => {
  const { id } = req.params;
  const { offering_id } = req.body;

  if (!offering_id) {
    return res.status(400).json({ error: 'offering_id required' });
  }

  const sql = `INSERT INTO user_courses (user_id, offering_id) VALUES (?, ?)`;

  db.run(sql, [id, offering_id], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint')) {
        return res.status(400).json({ error: 'Course offering already added' });
      }
      return res.status(500).json({ error: err.message });
    }

    res.status(201).json({
      id: this.lastID,
      user_id: parseInt(id),
      offering_id: offering_id,
      added_at: new Date().toISOString()
    });
  });
});

// Remove a course offering from user's list
router.delete('/:id/courses/:offering_id', (req, res) => {
  const { id, offering_id } = req.params;

  // First, delete all comparisons involving this offering for this user
  const deleteComparisons = `
    DELETE FROM comparisons
    WHERE user_id = ?
    AND (offering_a_id = ? OR offering_b_id = ?)
  `;

  db.run(deleteComparisons, [id, offering_id, offering_id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Then delete the user_courses entry
    const deleteUserCourse = `DELETE FROM user_courses WHERE user_id = ? AND offering_id = ?`;

    db.run(deleteUserCourse, [id, offering_id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Course offering not found in user list' });
      }

      res.json({ success: true });
    });
  });
});

module.exports = router;
