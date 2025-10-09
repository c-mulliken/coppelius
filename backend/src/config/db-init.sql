-- PostgreSQL schema for Coppelius

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  google_id TEXT UNIQUE,
  email TEXT UNIQUE,
  name TEXT,
  profile_picture TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  department TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE TABLE IF NOT EXISTS user_courses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  offering_id INTEGER NOT NULL REFERENCES offerings(id),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, offering_id)
);

CREATE TABLE IF NOT EXISTS comparisons (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  offering_a_id INTEGER NOT NULL REFERENCES offerings(id),
  offering_b_id INTEGER NOT NULL REFERENCES offerings(id),
  winner_offering_id INTEGER NOT NULL REFERENCES offerings(id),
  compared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, offering_a_id, offering_b_id)
);

CREATE TABLE IF NOT EXISTS offering_ratings (
  offering_id INTEGER PRIMARY KEY REFERENCES offerings(id),
  rating INTEGER DEFAULT 1500,
  comparison_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
