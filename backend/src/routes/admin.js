const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const { setupFuzzySearch } = require('../services/setupFuzzySearch');
const { setupVectorSearch } = require('../services/setupVectorSearch');
const { checkExtensions } = require('../services/checkExtensions');

// Simple admin secret for one-time scraping
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-me-in-production';

// Trigger course scraping (one-time use)
router.post('/scrape-courses', (req, res) => {
  const { secret } = req.body;

  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Send immediate response
  res.json({ success: true, message: 'Scraping started - check Railway logs for progress' });

  // Run the scraper in the background with streaming output
  console.log('Starting course scraper...');
  const scraper = spawn('node', ['src/services/courseScraper.js']);

  // Stream stdout in real-time
  scraper.stdout.on('data', (data) => {
    process.stdout.write(`[SCRAPER] ${data}`);
  });

  // Stream stderr in real-time
  scraper.stderr.on('data', (data) => {
    process.stderr.write(`[SCRAPER ERROR] ${data}`);
  });

  // Log when complete
  scraper.on('close', (code) => {
    if (code === 0) {
      console.log('Scraping completed successfully');
    } else {
      console.error(`Scraper exited with code ${code}`);
    }
  });

  scraper.on('error', (error) => {
    console.error('Failed to start scraper:', error);
  });
});

// Setup fuzzy search (enable pg_trgm extension)
router.post('/setup-fuzzy-search', async (req, res) => {
  const { secret } = req.body;

  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await setupFuzzySearch();
    res.json({ success: true, message: 'Fuzzy search setup complete' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Setup vector search (enable pgvector extension)
router.post('/setup-vector-search', async (req, res) => {
  const { secret } = req.body;

  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await setupVectorSearch();
    res.json({ success: true, message: 'Vector search setup complete' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check available PostgreSQL extensions
router.post('/check-extensions', async (req, res) => {
  const { secret } = req.body;

  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    await checkExtensions();
    res.json({ success: true, message: 'Check server logs for extension info' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove conference sections (sections starting with 'C')
router.post('/remove-conference-sections', async (req, res) => {
  const { secret } = req.body;

  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const db = require('../config/db');

  if (!db.pool) {
    return res.status(500).json({ error: 'Not connected to PostgreSQL' });
  }

  try {
    // First, get IDs of conference sections
    const conferenceOfferings = await db.pool.query(`
      SELECT id FROM offerings WHERE section LIKE 'C%'
    `);

    const offeringIds = conferenceOfferings.rows.map(row => row.id);

    if (offeringIds.length === 0) {
      return res.json({ success: true, message: 'No conference sections found', deleted: 0 });
    }

    // Delete related data first (to avoid foreign key violations)

    // 1. Delete from offering_ratings
    const ratingsResult = await db.pool.query(`
      DELETE FROM offering_ratings
      WHERE offering_id = ANY($1)
    `, [offeringIds]);

    // 2. Delete from comparisons
    const comparisonsResult = await db.pool.query(`
      DELETE FROM comparisons
      WHERE offering_a_id = ANY($1) OR offering_b_id = ANY($1::int[]) OR winner_offering_id = ANY($1::int[])
    `, [offeringIds]);

    // 3. Delete from user_courses
    const userCoursesResult = await db.pool.query(`
      DELETE FROM user_courses
      WHERE offering_id = ANY($1)
    `, [offeringIds]);

    // 4. Finally, delete the offerings themselves
    const offeringsResult = await db.pool.query(`
      DELETE FROM offerings
      WHERE section LIKE 'C%'
    `);

    res.json({
      success: true,
      message: `Removed ${offeringsResult.rowCount} conference sections`,
      deleted: {
        offerings: offeringsResult.rowCount,
        ratings: ratingsResult.rowCount,
        comparisons: comparisonsResult.rowCount,
        userCourses: userCoursesResult.rowCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove non-standard sections (I, C, L - keep only S sections)
router.post('/remove-non-standard-sections', async (req, res) => {
  const { secret } = req.body;

  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const db = require('../config/db');

  if (!db.pool) {
    return res.status(500).json({ error: 'Not connected to PostgreSQL' });
  }

  try {
    // Get IDs of non-standard sections (not starting with S)
    const nonStandardOfferings = await db.pool.query(`
      SELECT id FROM offerings WHERE section !~ '^S'
    `);

    const offeringIds = nonStandardOfferings.rows.map(row => row.id);

    if (offeringIds.length === 0) {
      return res.json({ success: true, message: 'No non-standard sections found', deleted: 0 });
    }

    // Delete related data first (to avoid foreign key violations)

    // 1. Delete from offering_ratings
    const ratingsResult = await db.pool.query(`
      DELETE FROM offering_ratings
      WHERE offering_id = ANY($1)
    `, [offeringIds]);

    // 2. Delete from comparisons
    const comparisonsResult = await db.pool.query(`
      DELETE FROM comparisons
      WHERE offering_a_id = ANY($1) OR offering_b_id = ANY($1::int[]) OR winner_offering_id = ANY($1::int[])
    `, [offeringIds]);

    // 3. Delete from user_courses
    const userCoursesResult = await db.pool.query(`
      DELETE FROM user_courses
      WHERE offering_id = ANY($1)
    `, [offeringIds]);

    // 4. Finally, delete the offerings themselves
    const offeringsResult = await db.pool.query(`
      DELETE FROM offerings
      WHERE section !~ '^S'
    `);

    res.json({
      success: true,
      message: `Removed ${offeringsResult.rowCount} non-standard sections (I, C, L)`,
      deleted: {
        offerings: offeringsResult.rowCount,
        ratings: ratingsResult.rowCount,
        comparisons: comparisonsResult.rowCount,
        userCourses: userCoursesResult.rowCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove lab sections (sections starting with 'L')
router.post('/remove-lab-sections', async (req, res) => {
  const { secret } = req.body;

  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const db = require('../config/db');

  if (!db.pool) {
    return res.status(500).json({ error: 'Not connected to PostgreSQL' });
  }

  try {
    // First, get IDs of lab sections
    const labOfferings = await db.pool.query(`
      SELECT id FROM offerings WHERE section LIKE 'L%'
    `);

    const offeringIds = labOfferings.rows.map(row => row.id);

    if (offeringIds.length === 0) {
      return res.json({ success: true, message: 'No lab sections found', deleted: 0 });
    }

    // Delete related data first (to avoid foreign key violations)

    // 1. Delete from offering_ratings
    const ratingsResult = await db.pool.query(`
      DELETE FROM offering_ratings
      WHERE offering_id = ANY($1)
    `, [offeringIds]);

    // 2. Delete from comparisons
    const comparisonsResult = await db.pool.query(`
      DELETE FROM comparisons
      WHERE offering_a_id = ANY($1) OR offering_b_id = ANY($1::int[]) OR winner_offering_id = ANY($1::int[])
    `, [offeringIds]);

    // 3. Delete from user_courses
    const userCoursesResult = await db.pool.query(`
      DELETE FROM user_courses
      WHERE offering_id = ANY($1)
    `, [offeringIds]);

    // 4. Finally, delete the offerings themselves
    const offeringsResult = await db.pool.query(`
      DELETE FROM offerings
      WHERE section LIKE 'L%'
    `);

    res.json({
      success: true,
      message: `Removed ${offeringsResult.rowCount} lab sections`,
      deleted: {
        offerings: offeringsResult.rowCount,
        ratings: ratingsResult.rowCount,
        comparisons: comparisonsResult.rowCount,
        userCourses: userCoursesResult.rowCount
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get database statistics
router.post('/db-stats', async (req, res) => {
  const { secret } = req.body;

  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const db = require('../config/db');

  if (!db.pool) {
    return res.status(500).json({ error: 'Not connected to PostgreSQL' });
  }

  try {
    // Get offerings per semester
    const semesterStats = await db.pool.query(`
      SELECT semester, COUNT(*) as count
      FROM offerings
      GROUP BY semester
      ORDER BY semester DESC
    `);

    // Get total counts
    const totals = await db.pool.query(`
      SELECT
        (SELECT COUNT(*) FROM courses) as total_courses,
        (SELECT COUNT(*) FROM offerings) as total_offerings,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM comparisons) as total_comparisons
    `);

    // Get courses with/without descriptions
    const descriptionStats = await db.pool.query(`
      SELECT
        COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) as with_description,
        COUNT(CASE WHEN description IS NULL OR description = '' THEN 1 END) as without_description
      FROM courses
    `);

    res.json({
      success: true,
      semesterStats: semesterStats.rows,
      totals: totals.rows[0],
      descriptionStats: descriptionStats.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset database (delete all data)
router.post('/reset-db', async (req, res) => {
  const { secret } = req.body;

  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const db = require('../config/db');

  if (!db.pool) {
    return res.status(500).json({ error: 'Not connected to PostgreSQL' });
  }

  try {
    // Delete in order to respect foreign key constraints
    await db.pool.query('DELETE FROM comparisons');
    await db.pool.query('DELETE FROM user_courses');
    await db.pool.query('DELETE FROM offering_ratings');
    await db.pool.query('DELETE FROM offerings');
    await db.pool.query('DELETE FROM courses');
    await db.pool.query('DELETE FROM users');

    res.json({
      success: true,
      message: 'Database reset complete - all data deleted'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
