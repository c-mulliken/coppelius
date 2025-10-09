const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/bellibrown.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database schema
function initializeDatabase() {
  db.serialize(() => {
    // Users table - lightweight user management
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Courses table - canonical course identity (e.g., "CSCI 0300")
    db.run(`
      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        department TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Offerings table - specific instance of a course (semester + professor)
    db.run(`
      CREATE TABLE IF NOT EXISTS offerings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        professor TEXT,
        semester TEXT,
        section TEXT,
        crn TEXT,
        srcdb TEXT,
        meeting_times TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses(id),
        UNIQUE(course_id, semester, professor, section)
      )
    `);

    // User courses table - tracks which course offerings users have taken
    db.run(`
      CREATE TABLE IF NOT EXISTS user_courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        offering_id INTEGER NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (offering_id) REFERENCES offerings(id),
        UNIQUE(user_id, offering_id)
      )
    `);

    // Comparisons table - stores pairwise offering comparisons
    db.run(`
      CREATE TABLE IF NOT EXISTS comparisons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        offering_a_id INTEGER NOT NULL,
        offering_b_id INTEGER NOT NULL,
        winner_offering_id INTEGER NOT NULL,
        compared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (offering_a_id) REFERENCES offerings(id),
        FOREIGN KEY (offering_b_id) REFERENCES offerings(id),
        FOREIGN KEY (winner_offering_id) REFERENCES offerings(id),
        UNIQUE(user_id, offering_a_id, offering_b_id)
      )
    `);

    // Offering ratings table - stores computed Elo ratings for each offering
    db.run(`
      CREATE TABLE IF NOT EXISTS offering_ratings (
        offering_id INTEGER PRIMARY KEY,
        rating INTEGER DEFAULT 1500,
        comparison_count INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (offering_id) REFERENCES offerings(id)
      )
    `);

    console.log('Database schema initialized');
  });
}

module.exports = db;
