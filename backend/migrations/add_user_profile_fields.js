/**
 * Migration: Add concentration and graduation_year to users table
 * Run with: node migrations/add_user_profile_fields.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pgConnectionString = process.env.DATABASE_URL ||
                           process.env.DATABASE_PRIVATE_URL ||
                           process.env.POSTGRES_URL;

if (!pgConnectionString) {
  console.error('No PostgreSQL connection string found. This migration is for production only.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: pgConnectionString,
  ssl: pgConnectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  try {
    console.log('Adding concentration and graduation_year fields to users table...');

    // Add concentration column
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS concentration TEXT
    `);
    console.log('✓ Added concentration column');

    // Add graduation_year column
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS graduation_year INTEGER
    `);
    console.log('✓ Added graduation_year column');

    console.log('\nMigration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
