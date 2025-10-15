/**
 * Migration: Add category support for comparisons
 * Run with: node migrations/add_comparison_categories.js
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
    console.log('Adding category support to comparisons and ratings...\n');

    // Step 1: Add category column to comparisons
    console.log('1. Adding category column to comparisons table...');
    await pool.query(`
      ALTER TABLE comparisons
      ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'overall'
    `);
    console.log('✓ Added category column to comparisons');

    // Step 2: Drop the old unique constraint and add new one with category
    console.log('\n2. Updating unique constraint on comparisons...');
    try {
      await pool.query(`
        ALTER TABLE comparisons
        DROP CONSTRAINT IF EXISTS comparisons_user_id_offering_a_id_offering_b_id_key
      `);
      console.log('✓ Dropped old unique constraint');
    } catch (err) {
      console.log('⚠ Old constraint might not exist, continuing...');
    }

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS comparisons_user_offerings_category_unique
      ON comparisons (user_id, offering_a_id, offering_b_id, category)
    `);
    console.log('✓ Added new unique constraint with category');

    // Step 3: Migrate offering_ratings table
    console.log('\n3. Migrating offering_ratings table...');

    // Create temporary table with new schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS offering_ratings_new (
        offering_id INTEGER NOT NULL REFERENCES offerings(id),
        category TEXT NOT NULL DEFAULT 'overall',
        rating INTEGER DEFAULT 1500,
        comparison_count INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (offering_id, category)
      )
    `);
    console.log('✓ Created new ratings table structure');

    // Copy existing data to new table (all as 'overall' category)
    await pool.query(`
      INSERT INTO offering_ratings_new (offering_id, category, rating, comparison_count, updated_at)
      SELECT offering_id, 'overall', rating, comparison_count, updated_at
      FROM offering_ratings
      ON CONFLICT (offering_id, category) DO NOTHING
    `);
    console.log('✓ Copied existing ratings as "overall" category');

    // Drop old table and rename new one
    await pool.query(`DROP TABLE IF EXISTS offering_ratings CASCADE`);
    await pool.query(`ALTER TABLE offering_ratings_new RENAME TO offering_ratings`);
    console.log('✓ Replaced old ratings table');

    console.log('\n✅ Migration completed successfully!');
    console.log('\nCategories now supported:');
    console.log('  - difficulty');
    console.log('  - enjoyment');
    console.log('  - engagement');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
