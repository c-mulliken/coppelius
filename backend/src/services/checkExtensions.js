const db = require('../config/db');

/**
 * Check available PostgreSQL extensions
 */
async function checkExtensions() {
  console.log('Checking available PostgreSQL extensions...\n');

  if (!db.pool) {
    console.error('Error: Not connected to PostgreSQL');
    process.exit(1);
  }

  try {
    // Check available extensions
    console.log('Available extensions:');
    const available = await db.pool.query(`
      SELECT name, default_version, comment
      FROM pg_available_extensions
      WHERE name IN ('vector', 'pg_trgm', 'uuid-ossp', 'pgcrypto')
      ORDER BY name
    `);

    console.table(available.rows);

    // Check installed extensions
    console.log('\nInstalled extensions:');
    const installed = await db.pool.query(`
      SELECT extname, extversion
      FROM pg_extension
      ORDER BY extname
    `);

    console.table(installed.rows);

    console.log('\nPostgreSQL version:');
    const version = await db.pool.query('SELECT version()');
    console.log(version.rows[0].version);

  } catch (error) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

if (require.main === module) {
  checkExtensions();
}

module.exports = { checkExtensions };
