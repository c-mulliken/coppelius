require('dotenv').config();
const db = require('../config/db');
const { generateEmbeddingsBatch, createCourseText } = require('./embeddingService');

/**
 * Generate embeddings for all courses in the database
 * Processes in batches to optimize API usage
 */
async function generateAllEmbeddings() {
  console.log('Starting embedding generation for all courses...\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY environment variable not set');
    console.error('Please add it to your .env file or Railway environment variables');
    process.exit(1);
  }

  if (!db.pool) {
    console.error('❌ Error: Not connected to PostgreSQL');
    console.error('This script requires PostgreSQL with pgvector extension');
    process.exit(1);
  }

  try {
    // Get all courses
    console.log('Fetching courses from database...');
    const result = await db.pool.query(`
      SELECT id, code, title, description, department, embedding
      FROM courses
      ORDER BY id
    `);

    const courses = result.rows;
    console.log(`Found ${courses.length} courses\n`);

    // Filter courses that need embeddings
    const coursesNeedingEmbeddings = courses.filter(c => !c.embedding);
    const coursesWithEmbeddings = courses.length - coursesNeedingEmbeddings.length;

    console.log(`Already embedded: ${coursesWithEmbeddings}`);
    console.log(`Need embeddings: ${coursesNeedingEmbeddings.length}\n`);

    if (coursesNeedingEmbeddings.length === 0) {
      console.log('✅ All courses already have embeddings!');
      process.exit(0);
    }

    // Estimate cost
    const avgTokensPerCourse = 150; // Rough estimate
    const totalTokens = coursesNeedingEmbeddings.length * avgTokensPerCourse;
    const estimatedCost = (totalTokens / 1000000) * 0.02; // $0.02 per 1M tokens
    console.log(`Estimated cost: $${estimatedCost.toFixed(4)}`);
    console.log(`(Based on ~${avgTokensPerCourse} tokens per course)\n`);

    // Process in batches of 100 (well under OpenAI's 2048 limit)
    const BATCH_SIZE = 100;
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < coursesNeedingEmbeddings.length; i += BATCH_SIZE) {
      const batch = coursesNeedingEmbeddings.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(coursesNeedingEmbeddings.length / BATCH_SIZE);

      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} courses)...`);

      try {
        // Create texts for embedding
        const texts = batch.map(createCourseText);

        // Generate embeddings
        const embeddings = await generateEmbeddingsBatch(texts);

        // Update database
        for (let j = 0; j < batch.length; j++) {
          const course = batch[j];
          const embedding = embeddings[j];

          try {
            await db.pool.query(
              'UPDATE courses SET embedding = $1 WHERE id = $2',
              [JSON.stringify(embedding), course.id]
            );
            processed++;
          } catch (err) {
            console.error(`  Error updating ${course.code}:`, err.message);
            errors++;
          }
        }

        console.log(`  ✓ Batch ${batchNum} complete (${processed}/${coursesNeedingEmbeddings.length})\n`);

        // Small delay between batches to be respectful
        if (i + BATCH_SIZE < coursesNeedingEmbeddings.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (err) {
        console.error(`  ✗ Error processing batch ${batchNum}:`, err.message);
        errors += batch.length;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('Embedding generation complete!');
    console.log('='.repeat(50));
    console.log(`✓ Successfully embedded: ${processed}`);
    if (errors > 0) {
      console.log(`✗ Errors: ${errors}`);
    }
    console.log('\nYou can now use semantic search in your application!');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  generateAllEmbeddings();
}

module.exports = { generateAllEmbeddings };
