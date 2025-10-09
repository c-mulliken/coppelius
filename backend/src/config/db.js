// Unified database interface that works with both SQLite and PostgreSQL
const { Pool } = require('pg');

const isProduction = process.env.DATABASE_URL !== undefined;

let db;

if (isProduction) {
  // PostgreSQL for production
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  // Initialize PostgreSQL schema
  async function initializePostgres() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          google_id TEXT UNIQUE,
          email TEXT UNIQUE,
          name TEXT,
          profile_picture TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS courses (
          id SERIAL PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          department TEXT,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS offerings (
          id SERIAL PRIMARY KEY,
          course_id INTEGER NOT NULL REFERENCES courses(id),
          professor TEXT,
          semester TEXT,
          section TEXT,
          crn TEXT,
          srcdb TEXT,
          meeting_times TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(course_id, semester, professor, section)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_courses (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          offering_id INTEGER NOT NULL REFERENCES offerings(id),
          added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, offering_id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS comparisons (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          offering_a_id INTEGER NOT NULL REFERENCES offerings(id),
          offering_b_id INTEGER NOT NULL REFERENCES offerings(id),
          winner_offering_id INTEGER NOT NULL REFERENCES offerings(id),
          compared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, offering_a_id, offering_b_id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS offering_ratings (
          offering_id INTEGER PRIMARY KEY REFERENCES offerings(id),
          rating INTEGER DEFAULT 1500,
          comparison_count INTEGER DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('PostgreSQL schema initialized');
    } catch (error) {
      console.error('Error initializing PostgreSQL schema:', error);
      throw error;
    }
  }

  // Test connection and initialize
  pool.query('SELECT NOW()')
    .then(() => {
      console.log('Connected to PostgreSQL database');
      return initializePostgres();
    })
    .catch(err => {
      console.error('Error connecting to PostgreSQL:', err.message);
    });

  // Adapter to make PostgreSQL work like SQLite's callback API
  db = {
    get: (sql, params, callback) => {
      pool.query(sql, params)
        .then(result => callback(null, result.rows[0] || null))
        .catch(err => callback(err));
    },

    all: (sql, params, callback) => {
      pool.query(sql, params)
        .then(result => callback(null, result.rows))
        .catch(err => callback(err));
    },

    run: (sql, params, callback) => {
      // Handle INSERT...RETURNING id for PostgreSQL
      const isInsert = sql.trim().toUpperCase().startsWith('INSERT');

      if (isInsert && !sql.toUpperCase().includes('RETURNING')) {
        // Add RETURNING id to get lastID
        sql = sql.trim();
        if (sql.endsWith(';')) {
          sql = sql.slice(0, -1);
        }
        sql += ' RETURNING id';
      }

      pool.query(sql, params)
        .then(result => {
          const ctx = {
            lastID: result.rows[0]?.id || null,
            changes: result.rowCount || 0
          };
          callback.call(ctx, null);
        })
        .catch(err => callback(err));
    },

    pool // Export pool for direct access if needed
  };

  console.log('Using PostgreSQL');
} else {
  // Use SQLite for local development
  db = require('./database');
  console.log('Using SQLite (local development)');
}

module.exports = db;
