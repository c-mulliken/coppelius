const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const { setupFuzzySearch } = require('../services/setupFuzzySearch');
const { setupVectorSearch } = require('../services/setupVectorSearch');

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

  // Run the scraper in the background
  exec('node src/services/courseScraper.js', (error, stdout, stderr) => {
    if (error) {
      console.error('Scraper error:', error);
    } else {
      console.log('Scraper output:', stdout);
      console.log('Scraping completed successfully');
    }
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

module.exports = router;
