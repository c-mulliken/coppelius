require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('./config/passport');
const usersRouter = require('./routes/users');
const coursesRouter = require('./routes/courses');
const comparisonsRouter = require('./routes/comparisons');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup session store for production (PostgreSQL) vs development (memory)
let sessionStore;
if (process.env.DATABASE_URL) {
  const pgSession = require('connect-pg-simple')(session);
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  sessionStore = new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true, // Auto-create session table
  });
  console.log('Using PostgreSQL session store');
} else {
  // Use default memory store for local development
  console.log('Using memory session store (local dev)');
}

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Session configuration
app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'coppelius-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/courses', coursesRouter);
app.use('/', comparisonsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Belli API server running on port ${PORT}`);
});
