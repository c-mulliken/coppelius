const db = require('../config/db');

/**
 * Check available PostgreSQL extensions
 */
async function checkExtensions() {
  console.log('Checking available PostgreSQL extensions...\n');

  if (!db.pool) {
    throw new Error('Not connected to PostgreSQL');
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

    return {
      available: available.rows,
      installed: installed.rows,
      version: version.rows[0].version
    };

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

if (require.main === module) {
  checkExtensions()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { checkExtensions };
