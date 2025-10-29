-- Add grades table to store transcript grades
CREATE TABLE IF NOT EXISTS grades (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offering_id INTEGER NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  grade VARCHAR(5) NOT NULL, -- A, A-, B+, B, B-, C+, C, C-, D+, D, F, S, NC
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, offering_id)
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_grades_offering_id ON grades(offering_id);
CREATE INDEX IF NOT EXISTS idx_grades_user_id ON grades(user_id);

-- Add has_uploaded_transcript flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_uploaded_transcript BOOLEAN DEFAULT FALSE;
