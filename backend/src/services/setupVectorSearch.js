const db = require('../config/db');

/**
 * Setup vector search capabilities in PostgreSQL
 * 1. Enable pgvector extension
 * 2. Add embedding column to courses table
 * 3. Create vector similarity index
 */
async function setupVectorSearch() {
  console.log('Setting up vector search...\n');

  if (!db.pool) {
    console.error('Error: Not connected to PostgreSQL. Vector search requires PostgreSQL with pgvector.');
    process.exit(1);
  }

  try {
    // Step 1: Enable pgvector extension
    console.log('1. Enabling pgvector extension...');
    await db.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('   ✓ pgvector extension enabled\n');

    // Step 2: Add embedding column (1536 dimensions for OpenAI text-embedding-3-small)
    console.log('2. Adding embedding column to courses table...');
    await db.pool.query(`
      ALTER TABLE courses
      ADD COLUMN IF NOT EXISTS embedding vector(1536)
    `);
    console.log('   ✓ Embedding column added (1536 dimensions)\n');

    // Step 3: Create index for fast similarity search
    console.log('3. Creating vector similarity index...');
    await db.pool.query(`
      CREATE INDEX IF NOT EXISTS courses_embedding_idx
      ON courses
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);
    console.log('   ✓ Vector index created (IVFFlat with cosine similarity)\n');

    console.log('✅ Vector search setup complete!');
    console.log('\nNext steps:');
    console.log('1. Set OPENAI_API_KEY environment variable');
    console.log('2. Run: node src/services/generateEmbeddings.js');

  } catch (error) {
    console.error('❌ Error setting up vector search:', error.message);
    console.error('\nTroubleshooting:');
    console.error('- Ensure you are connected to PostgreSQL (not SQLite)');
    console.error('- Check if Railway PostgreSQL has pgvector extension available');
    console.error('- You may need to contact Railway support to enable pgvector');
    process.exit(1);
  }

  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  setupVectorSearch();
}

module.exports = { setupVectorSearch };
