require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('./config/passport');
const db = require('./config/db');
const usersRouter = require('./routes/users');
const coursesRouter = require('./routes/courses');
const comparisonsRouter = require('./routes/comparisons');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup session store for production (PostgreSQL) vs development (memory)
let sessionStore;
const pgConnectionString = process.env.DATABASE_URL ||
                           process.env.DATABASE_PRIVATE_URL ||
                           process.env.POSTGRES_URL;

if (pgConnectionString) {
  const pgSession = require('connect-pg-simple')(session);
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: pgConnectionString,
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
      partitioned: true, // CHIPS - allow cross-site cookies
    },
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/users', usersRouter);
app.use('/courses', coursesRouter);
app.use('/', comparisonsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Debug endpoint - check offering_ratings table
app.get('/debug/ratings', async (req, res) => {
  if (db.pool) {
    try {
      const result = await db.pool.query(`
        SELECT
          or_table.offering_id,
          or_table.category,
          or_table.rating,
          or_table.comparison_count,
          c.code,
          o.professor
        FROM offering_ratings or_table
        JOIN offerings o ON or_table.offering_id = o.id
        JOIN courses c ON o.course_id = c.id
        WHERE or_table.category = 'enjoyment'
        ORDER BY or_table.rating ASC
        LIMIT 20
      `);
      res.json({
        message: 'Lowest 20 ratings in offering_ratings table',
        data: result.rows
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(500).json({ error: 'PostgreSQL required' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Belli API server running on port ${PORT}`);
});
