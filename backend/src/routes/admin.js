const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

// Simple admin secret for one-time scraping
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'change-me-in-production';

// Trigger course scraping (one-time use)
router.post('/scrape-courses', (req, res) => {
  const { secret } = req.body;

  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Run the scraper in the background
  exec('node src/services/courseScraper.js', (error, stdout, stderr) => {
    if (error) {
      console.error('Scraper error:', error);
      return res.status(500).json({ error: 'Scraping failed', details: error.message });
    }
    console.log('Scraper output:', stdout);
    res.json({ success: true, message: 'Scraping completed', output: stdout });
  });

  res.json({ success: true, message: 'Scraping started in background' });
});

module.exports = router;
