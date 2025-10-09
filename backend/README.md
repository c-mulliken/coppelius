# Belli Backend API

Backend API for the Belli course comparison app at Brown University.

## Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Scrape course data:
```bash
npm run scrape
```

This will populate the database with all Brown courses since 2019.

4. Start the server:
```bash
npm run dev
```

## API Endpoints

### Courses

- `GET /api/courses/search?q=<query>` - Search for courses by code or title
- `GET /api/courses/user/:userId` - Get all courses for a user
- `POST /api/courses/user/:userId` - Add a course to user's list
  - Body: `{ "courseId": 123 }`
- `DELETE /api/courses/user/:userId/:courseId` - Remove a course from user's list

### Comparisons

- `GET /api/comparisons/next/:userId` - Get a random pair of courses to compare
- `POST /api/comparisons` - Submit a comparison result
  - Body: `{ "userId": "user123", "winnerCourseId": 1, "loserCourseId": 2 }`
- `GET /api/comparisons/leaderboard?limit=50` - Get top-rated courses
- `GET /api/comparisons/stats/:userId` - Get comparison stats for a user

## Database Schema

- **courses** - All Brown courses since 2019
- **user_courses** - Courses each user has taken
- **comparisons** - Pairwise course comparisons
- **course_ratings** - Elo ratings for courses based on comparisons
