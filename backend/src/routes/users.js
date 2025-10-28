const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { getFallbackConcentrations } = require('../services/concentrationScraper');
const { importTranscript } = require('../services/transcriptService');
const { verifyToken } = require('./auth');

// Middleware to verify user can only access their own data
function verifyUserAccess(req, res, next) {
  const requestedUserId = parseInt(req.params.id);
  const authenticatedUserId = req.userId;

  if (requestedUserId !== authenticatedUserId) {
    return res.status(403).json({ error: 'Forbidden: You can only access your own data' });
  }

  next();
}

// Get available concentrations
router.get('/concentrations', (req, res) => {
  res.json(getFallbackConcentrations());
});

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
router.get('/:id', verifyToken, verifyUserAccess, (req, res) => {
  const { id } = req.params;

  const sql = `SELECT id, name, email, concentration, graduation_year, created_at FROM users WHERE id = ?`;

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

// Update user profile
router.patch('/:id', verifyToken, verifyUserAccess, (req, res) => {
  const { id } = req.params;
  const { concentration, graduation_year } = req.body;

  if (!concentration || !graduation_year) {
    return res.status(400).json({ error: 'concentration and graduation_year required' });
  }

  const sql = `
    UPDATE users
    SET concentration = ?, graduation_year = ?
    WHERE id = ?
  `;

  db.run(sql, [concentration, graduation_year, id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: parseInt(id),
      concentration,
      graduation_year
    });
  });
});

// Get all course offerings for a user
router.get('/:id/courses', verifyToken, verifyUserAccess, (req, res) => {
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
      uc.grade,
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

// Get user's ranked courses based on comparisons with category breakdowns
router.get('/:id/rankings', verifyToken, verifyUserAccess, async (req, res) => {
  const { id } = req.params;

  // PostgreSQL implementation with category support
  if (db.pool) {
    try {
      // Get all user offerings with category-specific ratings
      const result = await db.pool.query(`
        WITH user_offerings AS (
          SELECT uc.offering_id
          FROM user_courses uc
          WHERE uc.user_id = $1
        )
        SELECT
          o.id as offering_id,
          c.code,
          c.title,
          o.professor,
          o.semester,

          -- Difficulty ratings
          MAX(CASE WHEN r.category = 'difficulty' THEN r.rating ELSE 1500 END) as difficulty_rating,
          COUNT(CASE WHEN comp.category = 'difficulty' AND (comp.offering_a_id = o.id OR comp.offering_b_id = o.id) THEN 1 END) as difficulty_comparisons,

          -- Enjoyment ratings
          MAX(CASE WHEN r.category = 'enjoyment' THEN r.rating ELSE 1500 END) as enjoyment_rating,
          COUNT(CASE WHEN comp.category = 'enjoyment' AND (comp.offering_a_id = o.id OR comp.offering_b_id = o.id) THEN 1 END) as enjoyment_comparisons,

          -- Engagement ratings
          MAX(CASE WHEN r.category = 'engagement' THEN r.rating ELSE 1500 END) as engagement_rating,
          COUNT(CASE WHEN comp.category = 'engagement' AND (comp.offering_a_id = o.id OR comp.offering_b_id = o.id) THEN 1 END) as engagement_comparisons,

          -- Overall stats
          COUNT(CASE WHEN comp.offering_a_id = o.id OR comp.offering_b_id = o.id THEN 1 END) as total_comparisons
        FROM user_offerings uo
        JOIN offerings o ON uo.offering_id = o.id
        JOIN courses c ON o.course_id = c.id
        LEFT JOIN offering_ratings r ON o.id = r.offering_id
        LEFT JOIN comparisons comp ON (comp.offering_a_id = o.id OR comp.offering_b_id = o.id) AND comp.user_id = $1
        GROUP BY o.id, c.code, c.title, o.professor, o.semester
        ORDER BY
          CASE WHEN COUNT(CASE WHEN comp.offering_a_id = o.id OR comp.offering_b_id = o.id THEN 1 END) > 0 THEN 0 ELSE 1 END,
          (MAX(CASE WHEN r.category = 'difficulty' THEN r.rating ELSE 1500 END) +
           MAX(CASE WHEN r.category = 'enjoyment' THEN r.rating ELSE 1500 END) +
           MAX(CASE WHEN r.category = 'engagement' THEN r.rating ELSE 1500 END)) / 3 DESC
      `, [id]);

      return res.json(result.rows);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // SQLite fallback (without category support for now)
  const sql = `
    WITH user_offerings AS (
      SELECT uc.offering_id
      FROM user_courses uc
      WHERE uc.user_id = ?
    )
    SELECT
      o.id as offering_id,
      c.code,
      c.title,
      o.professor,
      o.semester,
      1500 as difficulty_rating,
      0 as difficulty_comparisons,
      1500 as enjoyment_rating,
      0 as enjoyment_comparisons,
      1500 as engagement_rating,
      0 as engagement_comparisons,
      0 as total_comparisons
    FROM user_offerings uo
    JOIN offerings o ON uo.offering_id = o.id
    JOIN courses c ON o.course_id = c.id
    ORDER BY c.code
  `;

  db.all(sql, [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Add a course offering to user's list
router.post('/:id/courses', verifyToken, verifyUserAccess, (req, res) => {
  const { id } = req.params;
  const { offering_id, grade } = req.body;

  if (!offering_id) {
    return res.status(400).json({ error: 'offering_id required' });
  }

  const sql = `INSERT INTO user_courses (user_id, offering_id, grade) VALUES (?, ?, ?)`;

  db.run(sql, [id, offering_id, grade || null], function(err) {
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
      grade: grade || null,
      added_at: new Date().toISOString()
    });
  });
});

// Remove a course offering from user's list
router.delete('/:id/courses/:offering_id', verifyToken, verifyUserAccess, (req, res) => {
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

// Upload and import transcript
router.post('/:id/transcript', verifyToken, verifyUserAccess, async (req, res) => {
  const { id } = req.params;
  const { htmlContent } = req.body;

  if (!htmlContent) {
    return res.status(400).json({ error: 'htmlContent required in request body' });
  }

  try {
    const results = await importTranscript(parseInt(id), htmlContent);
    res.json(results);
  } catch (err) {
    console.error('Error importing transcript:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
