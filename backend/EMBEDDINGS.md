# Course Embeddings Setup

This document explains how to set up and use the course embedding system for future semantic search capabilities.

## Overview

We use **OpenAI text-embedding-3-small** to generate 1536-dimensional vector embeddings for course titles and descriptions. These are stored in PostgreSQL using the **pgvector** extension.

## Setup Steps

### 1. Enable pgvector Extension (Railway)

Run this once to set up the database:

```bash
railway run --service backend node src/services/setupVectorSearch.js
```

This will:
- Enable the pgvector extension
- Add an `embedding` column to the `courses` table (1536 dimensions)
- Create a vector similarity index using IVFFlat

### 2. Set OpenAI API Key

Add to Railway environment variables:

```
OPENAI_API_KEY=sk-...your-key-here...
```

Get your API key from: https://platform.openai.com/api-keys

### 3. Generate Embeddings

Run this to generate embeddings for all courses:

```bash
railway run --service backend node src/services/generateEmbeddings.js
```

This will:
- Fetch all courses from the database
- Generate embeddings in batches of 100
- Store embeddings in the `embedding` column
- Show progress and estimated cost

**Estimated Cost**: ~$0.05 for 2000 courses

## Architecture

### Files Created

- **`src/services/embeddingService.js`** - Core embedding functionality
  - `generateEmbedding(text)` - Generate single embedding
  - `generateEmbeddingsBatch(texts[])` - Batch generation (up to 2048)
  - `createCourseText(course)` - Format course data for embedding
  - `cosineSimilarity(a, b)` - Calculate similarity between vectors

- **`src/services/setupVectorSearch.js`** - Database setup script
- **`src/services/generateEmbeddings.js`** - Embedding generation script

### Database Schema

```sql
-- Added to courses table
ALTER TABLE courses ADD COLUMN embedding vector(1536);

-- Index for fast similarity search
CREATE INDEX courses_embedding_idx
ON courses USING ivfflat (embedding vector_cosine_ops);
```

## How Embeddings Work

Each course is converted to text combining:
```
Course: HIST 0150A
Title: History of Capitalism
Description: Capitalism didn't just spring from...
Department: HIST
```

This text is sent to OpenAI's API which returns a 1536-dimensional vector representing the semantic meaning.

## Future: Semantic Search

When ready to implement semantic search:

1. **Embed user query**: Convert search text to vector
2. **Find similar courses**: Use cosine similarity in PostgreSQL:
   ```sql
   SELECT code, title,
          1 - (embedding <=> query_embedding) as similarity
   FROM courses
   WHERE embedding IS NOT NULL
   ORDER BY embedding <=> query_embedding
   LIMIT 10
   ```
3. **Hybrid search**: Combine keyword + semantic results

## Maintenance

### Re-generate Embeddings

If you update course descriptions:
```bash
# Clear embeddings
railway run --service backend psql $DATABASE_URL -c "UPDATE courses SET embedding = NULL"

# Regenerate
railway run --service backend node src/services/generateEmbeddings.js
```

### Check Embedding Status

```sql
-- Count embedded courses
SELECT COUNT(*) FROM courses WHERE embedding IS NOT NULL;

-- Find courses without embeddings
SELECT code, title FROM courses WHERE embedding IS NULL;
```

## Cost Estimation

- **Model**: text-embedding-3-small
- **Cost**: $0.02 per 1 million tokens
- **Average**: ~150 tokens per course
- **Total for 2000 courses**: ~300,000 tokens = $0.006

Actual cost will be shown when running the generation script.

## Dependencies

- `openai` - OpenAI Node.js SDK
- PostgreSQL with `pgvector` extension
- OpenAI API key

## Notes

- Embeddings are stored as JSON arrays in PostgreSQL
- The `ivfflat` index provides approximate nearest neighbor search
- Cosine similarity is used for measuring vector similarity (0-1)
- Batch processing (100 courses at a time) optimizes API usage
