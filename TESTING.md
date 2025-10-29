# Testing Strategy for Coppelius

## Overview

This document outlines the testing strategy for the Coppelius course ranking and comparison platform.

## Testing Levels

### 1. Unit Tests
Test individual functions and utilities in isolation.

**Backend Unit Tests** (Jest)
- `src/services/eloService.js`
  - `calculateExpectedScore()` - Verify Elo win probability calculations
  - `calculateNewRating()` - Verify rating updates with K-factor
  - Edge cases: Equal ratings, extreme rating differences

- `src/services/transcriptParser.js`
  - `parseTranscript()` - Extract courses from HTML
  - `convertToSemesterCode()` - Academic year encoding (Spring 2024 → 202320)
  - Edge cases: Empty transcripts, malformed HTML

- `src/utils/formatters.js` (if created)
  - Semester formatting
  - Date formatting

**Frontend Unit Tests** (Vitest)
- Utility functions (semester formatting, Elo normalization)
- Helper functions
- Pure computation logic

### 2. Integration Tests
Test API endpoints with real database operations.

**API Integration Tests** (Jest + Supertest + Test Database)

Test database: Use separate PostgreSQL test database that gets reset before each test.

**Authentication & Users**
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /users/:id/profile` - Get user profile
- `POST /users/:id/profile` - Update user profile (concentration, grad year)

**Courses & Offerings**
- `GET /courses` - List courses with search/filter
- `GET /courses/:id/offerings` - List offerings for a course
- `GET /courses/rankings` - Get ranked offerings
- `GET /courses/offerings/:id/grade-distribution` - Grade distribution (with/without transcript)

**Comparisons**
- `GET /users/:id/compare/next` - Get next comparison pair
  - Test adaptive sampling (uncertainty + diversity)
  - Test early stopping (15 comparisons)
  - Test when all pairs compared
- `POST /users/:id/compare` - Submit comparison
  - Verify Elo ratings update
  - Test duplicate prevention
  - Test winner/loser calculation
- `DELETE /users/:id/compare/last` - Undo last comparison
  - Verify comparison deleted
  - Verify Elo ratings recalculated

**Transcript Upload**
- `POST /users/:id/transcript/upload` - Upload transcript
  - Verify courses added to user_courses
  - Verify grades added to grades table
  - Verify has_uploaded_transcript flag set
  - Test semester encoding correctness

**Critical Test Cases:**
1. **Elo Rating Decrease**: Verify losers decrease below 1500
2. **Adaptive Sampling**: Verify uncertain pairs prioritized
3. **Diversity Bonus**: Verify undersampled courses prioritized
4. **Semester Encoding**: Verify Spring 2024 → 202320 (academic year)
5. **Grade Distribution Privacy**: Verify minimum 5 grades threshold
6. **Transcript Auth Gate**: Verify 403 when user hasn't uploaded transcript

### 3. End-to-End Tests
Test full user workflows in the browser.

**E2E Tests** (Playwright or Cypress)

**User Onboarding Flow**
1. User logs in via Google OAuth
2. Onboarding modal appears (first time only)
3. User selects concentration and graduation year
4. Modal closes, redirects to compare view

**Course Addition Flow**
1. User searches for course
2. User adds course to their list
3. Course appears in "My Courses"
4. Transcript upload works

**Comparison Flow**
1. User sees two course offerings
2. User selects winner
3. Next pair loads automatically
4. Progress indicator updates (X/15)
5. "Undo" button works
6. After 15 comparisons, success message appears

**Rankings Flow**
1. User navigates to Rankings tab
2. Rankings load with ratings
3. Search/filter/sort works
4. Click course to expand grade distribution
5. If no transcript: "Upload your transcript" message
6. If transcript uploaded: Bar chart shows

**Transcript Upload Flow**
1. User clicks "upload transcript"
2. Modal opens
3. User uploads PDF
4. Courses are extracted and added
5. Success message shows
6. Grade distributions now visible

## Test Infrastructure

### Backend Testing Setup

```bash
# Install dependencies
npm install --save-dev jest supertest

# Test database setup
# Use environment variable for test database
export DATABASE_URL="postgresql://user:pass@localhost:5432/coppelius_test"
```

**jest.config.js:**
```javascript
module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};
```

**tests/setup.js:**
```javascript
const db = require('../src/config/db');

beforeAll(async () => {
  // Connect to test database
  // Run migrations
});

afterEach(async () => {
  // Clear all tables
  await db.pool.query('TRUNCATE TABLE comparisons, grades, user_courses, offering_ratings, users, offerings, courses RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  // Close database connection
  await db.pool.end();
});
```

### Frontend Testing Setup

```bash
# Install dependencies
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
npm install --save-dev @playwright/test  # For E2E
```

**vite.config.js:**
```javascript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
  },
});
```

## Example Test Files

### Backend Example: `tests/comparisons.test.js`

```javascript
const request = require('supertest');
const app = require('../src/index');
const db = require('../src/config/db');

describe('POST /users/:id/compare', () => {
  let userId, offering1Id, offering2Id;

  beforeEach(async () => {
    // Create test data
    const userResult = await db.pool.query(
      'INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id',
      ['test@brown.edu', 'test123']
    );
    userId = userResult.rows[0].id;

    const courseResult = await db.pool.query(
      'INSERT INTO courses (code, title) VALUES ($1, $2) RETURNING id',
      ['CSCI 0150', 'Intro to CS']
    );
    const courseId = courseResult.rows[0].id;

    const offering1 = await db.pool.query(
      'INSERT INTO offerings (course_id, professor, semester) VALUES ($1, $2, $3) RETURNING id',
      [courseId, 'Prof A', '202410']
    );
    offering1Id = offering1.rows[0].id;

    const offering2 = await db.pool.query(
      'INSERT INTO offerings (course_id, professor, semester) VALUES ($1, $2, $3) RETURNING id',
      [courseId, 'Prof B', '202410']
    );
    offering2Id = offering2.rows[0].id;

    // Add offerings to user's courses
    await db.pool.query(
      'INSERT INTO user_courses (user_id, offering_id) VALUES ($1, $2), ($1, $3)',
      [userId, offering1Id, offering2Id]
    );
  });

  it('should update Elo ratings correctly when submitting comparison', async () => {
    // Submit comparison
    const response = await request(app)
      .post(`/users/${userId}/compare`)
      .send({
        offering_a_id: offering1Id,
        offering_b_id: offering2Id,
        winner_offering_id: offering1Id,
        category: 'enjoyment'
      })
      .expect(201);

    // Check Elo ratings were updated
    const ratings = await db.pool.query(
      'SELECT offering_id, rating FROM offering_ratings WHERE category = $1 ORDER BY offering_id',
      ['enjoyment']
    );

    expect(ratings.rows).toHaveLength(2);
    expect(ratings.rows[0].rating).toBeGreaterThan(1500); // Winner increased
    expect(ratings.rows[1].rating).toBeLessThan(1500); // Loser decreased
  });

  it('should prevent duplicate comparisons', async () => {
    // Submit first comparison
    await request(app)
      .post(`/users/${userId}/compare`)
      .send({
        offering_a_id: offering1Id,
        offering_b_id: offering2Id,
        winner_offering_id: offering1Id,
        category: 'enjoyment'
      })
      .expect(201);

    // Try to submit same comparison again
    await request(app)
      .post(`/users/${userId}/compare`)
      .send({
        offering_a_id: offering1Id,
        offering_b_id: offering2Id,
        winner_offering_id: offering1Id,
        category: 'enjoyment'
      })
      .expect(400);
  });
});
```

### Frontend Example: `tests/ComparisonView.test.jsx`

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ComparisonView from '../src/components/ComparisonView';
import { api } from '../src/api/client';

vi.mock('../src/api/client');

describe('ComparisonView', () => {
  beforeEach(() => {
    api.getNextComparison.mockResolvedValue({
      data: {
        offering_a: { code: 'CSCI 0150', professor: 'Prof A', semester: '202410' },
        offering_b: { code: 'CSCI 0150', professor: 'Prof B', semester: '202410' },
        category: 'enjoyment',
        remaining_comparisons: 10,
        total_comparisons: 5
      }
    });

    api.submitComparison.mockResolvedValue({ data: { success: true } });
  });

  it('should display two offerings for comparison', async () => {
    render(<ComparisonView userId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Prof A')).toBeInTheDocument();
      expect(screen.getByText('Prof B')).toBeInTheDocument();
    });
  });

  it('should submit comparison when user clicks a choice', async () => {
    render(<ComparisonView userId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Prof A')).toBeInTheDocument();
    });

    const choiceA = screen.getByText('Prof A').closest('button');
    fireEvent.click(choiceA);

    await waitFor(() => {
      expect(api.submitComparison).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ winner_offering_id: expect.any(Number) })
      );
    });
  });

  it('should show progress indicator', async () => {
    render(<ComparisonView userId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/5\/15/)).toBeInTheDocument();
    });
  });
});
```

### E2E Example: `e2e/comparison-flow.spec.js`

```javascript
import { test, expect } from '@playwright/test';

test.describe('Comparison Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login (or mock auth)
    await page.goto('http://localhost:5173');
    // Assume already logged in for simplicity
  });

  test('should allow user to complete full comparison flow', async ({ page }) => {
    // Should see comparison view
    await expect(page.locator('text=Which did you enjoy more?')).toBeVisible();

    // Should see two course offerings
    const offerings = await page.locator('[data-testid="offering-card"]').count();
    expect(offerings).toBe(2);

    // Click first offering
    await page.locator('[data-testid="offering-card"]').first().click();

    // Should load next comparison
    await expect(page.locator('text=Which did you enjoy more?')).toBeVisible();

    // Progress should increment
    await expect(page.locator('text=/[0-9]+\/15/')).toBeVisible();
  });

  test('should show success message after 15 comparisons', async ({ page }) => {
    // Mock API to return enough_comparisons: true
    await page.route('**/users/*/compare/next', (route) => {
      route.fulfill({
        json: {
          offering_a: { /* ... */ },
          offering_b: { /* ... */ },
          enough_comparisons: true,
          total_comparisons: 15
        }
      });
    });

    await page.goto('http://localhost:5173');

    await expect(page.locator('text=/You.*ve made enough comparisons/')).toBeVisible();
  });
});
```

## Running Tests

### Backend
```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/comparisons.test.js

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Frontend
```bash
# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Open Playwright UI
npx playwright test --ui
```

## CI/CD Integration

Add to GitHub Actions workflow:

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: coppelius_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install backend dependencies
        working-directory: ./backend
        run: npm ci

      - name: Run backend tests
        working-directory: ./backend
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/coppelius_test
        run: npm test

      - name: Install frontend dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Run frontend tests
        working-directory: ./frontend
        run: npm test
```

## Test Coverage Goals

- **Backend**: Aim for 80%+ coverage on services and routes
- **Frontend**: Aim for 70%+ coverage on components and utilities
- **E2E**: Cover all critical user flows (comparison, rankings, transcript upload)

## Next Steps

1. Set up Jest configuration for backend
2. Write initial test suite for Elo service (critical!)
3. Set up test database and migration scripts
4. Add Vitest configuration for frontend
5. Write tests for comparison flow
6. Set up Playwright for E2E tests
7. Add CI/CD pipeline with test running
