const db = require('../config/db');

/**
 * Setup fuzzy search capabilities in PostgreSQL
 * Enables pg_trgm extension for trigram similarity matching
 */
async function setupFuzzySearch() {
  console.log('Setting up fuzzy search...\n');

  if (!db.pool) {
    console.error('Error: Not connected to PostgreSQL. Fuzzy search requires PostgreSQL.');
    process.exit(1);
  }

  try {
    // Enable pg_trgm extension for trigram similarity
    console.log('1. Enabling pg_trgm extension...');
    await db.pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    console.log('   ✓ pg_trgm extension enabled\n');

    // Create GIN index for faster trigram matching on course code and title
    console.log('2. Creating trigram index on courses...');
    await db.pool.query(`
      CREATE INDEX IF NOT EXISTS courses_code_title_trgm_idx
      ON courses
      USING gin ((LOWER(code || ' ' || title)) gin_trgm_ops)
    `);
    console.log('   ✓ Trigram index created\n');

    console.log('✅ Fuzzy search setup complete!');
    console.log('\nSearch now supports:');
    console.log('- Case-insensitive matching');
    console.log('- Misspelling tolerance (e.g., "compter" → "computer")');
    console.log('- Results ranked by similarity score');

  } catch (error) {
    console.error('❌ Error setting up fuzzy search:', error.message);
    console.error('\nTroubleshooting:');
    console.error('- Ensure you are connected to PostgreSQL (not SQLite)');
    console.error('- Check if Railway PostgreSQL has pg_trgm extension available');
    process.exit(1);
  }

  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  setupFuzzySearch();
}

module.exports = { setupFuzzySearch };
