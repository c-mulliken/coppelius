const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;

        // Restrict to Brown.edu emails only
        if (!email.endsWith('@brown.edu')) {
          return done(null, false, { message: 'Only Brown University email addresses are allowed' });
        }

        // Check if user exists
        db.get('SELECT * FROM users WHERE google_id = ?', [profile.id], (err, user) => {
          if (err) {
            return done(err);
          }

          if (user) {
            // User exists, return it
            return done(null, user);
          } else {
            // Create new user
            const sql = `
              INSERT INTO users (google_id, email, name, profile_picture)
              VALUES (?, ?, ?, ?)
            `;
            const params = [
              profile.id,
              email,
              profile.displayName,
              profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            ];

            db.run(sql, params, function (err) {
              if (err) {
                return done(err);
              }

              const newUser = {
                id: this.lastID,
                google_id: profile.id,
                email: email,
                name: profile.displayName,
                profile_picture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
              };

              return done(null, newUser);
            });
          }
        });
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Serialize user to session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser((id, done) => {
  db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
    done(err, user);
  });
});

module.exports = passport;
