const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { updateEloRatings } = require('../services/eloService');

// GET /users/:id/comparisons - Get all comparisons made by user
router.get('/users/:id/comparisons', (req, res) => {
  const userId = req.params.id;

  const sql = `
    SELECT
      c.id,
      c.compared_at,
      c.winner_offering_id,
      oa.id as offering_a_id,
      ca.code as code_a,
      ca.title as title_a,
      oa.professor as professor_a,
      oa.semester as semester_a,
      ob.id as offering_b_id,
      cb.code as code_b,
      cb.title as title_b,
      ob.professor as professor_b,
      ob.semester as semester_b
    FROM comparisons c
    JOIN offerings oa ON c.offering_a_id = oa.id
    JOIN offerings ob ON c.offering_b_id = ob.id
    JOIN courses ca ON oa.course_id = ca.id
    JOIN courses cb ON ob.course_id = cb.id
    WHERE c.user_id = ?
    ORDER BY c.compared_at DESC
  `;

  db.all(sql, [userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// GET /users/:id/compare/next - Get next pair of offerings to compare
router.get('/users/:id/compare/next', (req, res) => {
  const userId = req.params.id;
  const categories = ['difficulty', 'enjoyment', 'engagement'];

  // Get all offerings the user has taken
  const takenSql = `
    SELECT offering_id
    FROM user_courses
    WHERE user_id = ?
  `;

  db.all(takenSql, [userId], (err, taken) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (taken.length < 2) {
      return res.status(400).json({
        error: 'User needs at least 2 course offerings to compare'
      });
    }

    const offeringIds = taken.map(row => row.offering_id);

    // Get all pairs the user has already compared (with categories)
    const comparedSql = `
      SELECT offering_a_id, offering_b_id, category
      FROM comparisons
      WHERE user_id = ?
    `;

    db.all(comparedSql, [userId], (err, compared) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Build set of compared pairs with categories
      const comparedPairs = new Set();
      compared.forEach(row => {
        const [a, b] = [row.offering_a_id, row.offering_b_id].sort((x, y) => x - y);
        comparedPairs.add(`${a}-${b}-${row.category}`);
      });

      // Find all unpaired combinations for each category
      const unpaired = [];
      for (let i = 0; i < offeringIds.length; i++) {
        for (let j = i + 1; j < offeringIds.length; j++) {
          const [a, b] = [offeringIds[i], offeringIds[j]].sort((x, y) => x - y);

          for (const category of categories) {
            const pairKey = `${a}-${b}-${category}`;
            if (!comparedPairs.has(pairKey)) {
              unpaired.push({
                offering_a_id: offeringIds[i],
                offering_b_id: offeringIds[j],
                category
              });
            }
          }
        }
      }

      if (unpaired.length === 0) {
        return res.status(200).json({
          message: 'All course offering pairs have been compared'
        });
      }

      // Pick a random unpaired combination
      const selected = unpaired[Math.floor(Math.random() * unpaired.length)];

      // Fetch offering details with course info
      const detailsSql = `
        SELECT
          o.id,
          c.code,
          c.title,
          o.professor,
          o.semester,
          o.section
        FROM offerings o
        JOIN courses c ON o.course_id = c.id
        WHERE o.id IN (?, ?)
      `;

      db.all(detailsSql, [selected.offering_a_id, selected.offering_b_id], (err, offerings) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        const offeringA = offerings.find(o => o.id === selected.offering_a_id);
        const offeringB = offerings.find(o => o.id === selected.offering_b_id);

        res.json({
          offering_a: offeringA,
          offering_b: offeringB,
          category: selected.category,
          remaining_comparisons: unpaired.length
        });
      });
    });
  });
});

// POST /users/:id/compare - Submit a comparison
router.post('/users/:id/compare', (req, res) => {
  const userId = req.params.id;
  const { offering_a_id, offering_b_id, winner_offering_id, category } = req.body;

  if (!offering_a_id || !offering_b_id || !winner_offering_id || !category) {
    return res.status(400).json({
      error: 'offering_a_id, offering_b_id, winner_offering_id, and category required'
    });
  }

  const validCategories = ['difficulty', 'enjoyment', 'engagement'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  if (offering_a_id === offering_b_id) {
    return res.status(400).json({ error: 'Cannot compare an offering to itself' });
  }

  if (winner_offering_id !== offering_a_id && winner_offering_id !== offering_b_id) {
    return res.status(400).json({ error: 'winner_offering_id must be either offering_a_id or offering_b_id' });
  }

  const loserOfferingId = winner_offering_id === offering_a_id ? offering_b_id : offering_a_id;

  // Insert comparison (with normalized ordering to prevent duplicates)
  const [a, b] = [offering_a_id, offering_b_id].sort((x, y) => x - y);

  const insertSql = `
    INSERT INTO comparisons (user_id, offering_a_id, offering_b_id, winner_offering_id, category)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(insertSql, [userId, a, b, winner_offering_id, category], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint')) {
        return res.status(400).json({ error: 'This comparison has already been recorded' });
      }
      return res.status(500).json({ error: err.message });
    }

    // Update Elo ratings for this category
    updateEloRatings(winner_offering_id, loserOfferingId, category, (err) => {
      if (err) {
        console.error('Error updating Elo ratings:', err);
      }

      res.status(201).json({
        id: this.lastID,
        user_id: parseInt(userId),
        offering_a_id,
        offering_b_id,
        winner_offering_id,
        category,
        compared_at: new Date().toISOString()
      });
    });
  });
});

// DELETE /users/:id/compare/last - Undo last comparison
router.delete('/users/:id/compare/last', async (req, res) => {
  const userId = req.params.id;

  try {
    // PostgreSQL implementation
    if (db.pool) {
      // Get the last comparison
      const lastComparisonResult = await db.pool.query(`
        SELECT id, offering_a_id, offering_b_id, winner_offering_id, category
        FROM comparisons
        WHERE user_id = $1
        ORDER BY compared_at DESC
        LIMIT 1
      `, [userId]);

      if (lastComparisonResult.rows.length === 0) {
        return res.status(404).json({ error: 'No comparisons to undo' });
      }

      const lastComparison = lastComparisonResult.rows[0];
      const winnerId = lastComparison.winner_offering_id;
      const loserId = winnerId === lastComparison.offering_a_id
        ? lastComparison.offering_b_id
        : lastComparison.offering_a_id;
      const category = lastComparison.category;

      // Delete the comparison
      await db.pool.query(`
        DELETE FROM comparisons
        WHERE id = $1
      `, [lastComparison.id]);

      // Recalculate Elo ratings for both offerings in this category
      // We'll reverse the Elo update by recalculating from scratch
      updateEloRatings(loserId, winnerId, category, (err) => {
        if (err) {
          console.error('Error updating Elo ratings during undo:', err);
        }
      });

      return res.json({ success: true, undone_comparison_id: lastComparison.id });
    }

    // SQLite fallback
    const sql = `
      SELECT id, offering_a_id, offering_b_id, winner_offering_id, category
      FROM comparisons
      WHERE user_id = ?
      ORDER BY compared_at DESC
      LIMIT 1
    `;

    db.get(sql, [userId], (err, lastComparison) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!lastComparison) {
        return res.status(404).json({ error: 'No comparisons to undo' });
      }

      const winnerId = lastComparison.winner_offering_id;
      const loserId = winnerId === lastComparison.offering_a_id
        ? lastComparison.offering_b_id
        : lastComparison.offering_a_id;
      const category = lastComparison.category;

      // Delete the comparison
      const deleteSql = `DELETE FROM comparisons WHERE id = ?`;

      db.run(deleteSql, [lastComparison.id], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        // Recalculate Elo ratings for this category
        updateEloRatings(loserId, winnerId, category, (err) => {
          if (err) {
            console.error('Error updating Elo ratings during undo:', err);
          }
        });

        res.json({ success: true, undone_comparison_id: lastComparison.id });
      });
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
