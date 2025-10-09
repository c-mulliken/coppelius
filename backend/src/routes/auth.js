const express = require('express');
const passport = require('../config/passport');
const router = express.Router();

// Initiate Google OAuth flow
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    // Successful authentication, redirect to frontend
    console.log('OAuth callback - User authenticated:', req.user);
    console.log('Session ID:', req.sessionID);
    const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(frontendURL);
  }
);

// Auth failure endpoint
router.get('/failure', (req, res) => {
  res.status(401).json({ error: 'Authentication failed. Only Brown University emails are allowed.' });
});

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// Get current user
router.get('/me', (req, res) => {
  console.log('/auth/me called - Session ID:', req.sessionID);
  console.log('Is authenticated:', req.isAuthenticated());
  console.log('Session:', req.session);
  console.log('User:', req.user);

  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(req.user);
});

module.exports = router;
