// Unified database interface that works with both SQLite and PostgreSQL
const { Pool } = require('pg');

// Check for PostgreSQL connection string (Railway might use different variable names)
const pgConnectionString = process.env.DATABASE_URL ||
                           process.env.DATABASE_PRIVATE_URL ||
                           process.env.POSTGRES_URL;

const isProduction = pgConnectionString !== undefined;

let db;

if (isProduction) {
  // PostgreSQL for production
  // Parse connection string to check if SSL is supported
  const sslConfig = pgConnectionString.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : false;

  const pool = new Pool({
    connectionString: pgConnectionString,
    ssl: sslConfig,
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
          concentration TEXT,
          graduation_year INTEGER,
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
          category TEXT NOT NULL DEFAULT 'overall',
          compared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, offering_a_id, offering_b_id, category)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS offering_ratings (
          offering_id INTEGER NOT NULL REFERENCES offerings(id),
          category TEXT NOT NULL DEFAULT 'overall',
          rating INTEGER DEFAULT 1500,
          comparison_count INTEGER DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (offering_id, category)
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
      // Convert ? placeholders to $1, $2, etc for PostgreSQL
      const pgSql = convertPlaceholders(sql);
      pool.query(pgSql, params)
        .then(result => callback(null, result.rows[0] || null))
        .catch(err => callback(err));
    },

    all: (sql, params, callback) => {
      const pgSql = convertPlaceholders(sql);
      pool.query(pgSql, params)
        .then(result => callback(null, result.rows))
        .catch(err => callback(err));
    },

    run: (sql, params, callback) => {
      let pgSql = convertPlaceholders(sql);

      // Handle INSERT...RETURNING id for PostgreSQL
      const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
      const hasOnConflict = pgSql.toUpperCase().includes('ON CONFLICT');

      // Only add RETURNING id for regular INSERTs (not UPSERTs) and if not already present
      if (isInsert && !hasOnConflict && !pgSql.toUpperCase().includes('RETURNING')) {
        // Add RETURNING id to get lastID
        pgSql = pgSql.trim();
        if (pgSql.endsWith(';')) {
          pgSql = pgSql.slice(0, -1);
        }
        pgSql += ' RETURNING id';
      }

      pool.query(pgSql, params)
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

  // Helper function to convert SQLite ? placeholders to PostgreSQL $1, $2, etc
  function convertPlaceholders(sql) {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
  }

  console.log('Using PostgreSQL');
} else {
  // Use SQLite for local development
  db = require('./database');
  console.log('Using SQLite (local development)');
}

module.exports = db;
