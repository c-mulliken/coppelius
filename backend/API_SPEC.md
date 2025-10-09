# Belli API Specification

Base URL: `http://localhost:3000`

## Overview

The API distinguishes between **courses** (canonical course identity like "CSCI 0300") and **offerings** (specific instances taught by a professor in a semester). Users compare specific offerings, not abstract courses.

---

## User Management

### Create User
```
POST /users
```
Creates a new user with a unique ID.

**Response:**
```json
{
  "id": 1,
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

### Get User Profile
```
GET /users/:id
```
Fetches basic user profile.

**Response:**
```json
{
  "id": 1,
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

---

## Course Management

### List Courses
```
GET /courses?search=<query>&department=<dept>
```
Returns list of canonical courses. Both parameters are optional.

**Query Parameters:**
- `search` - Search by course code or title
- `department` - Filter by department (e.g., "CSCI", "ENGL")

**Response:**
```json
[
  {
    "id": 1,
    "code": "CSCI 0300",
    "title": "Fundamentals of Computer Systems",
    "department": "CSCI"
  }
]
```

### Get Course Details
```
GET /courses/:id
```
Returns course metadata.

**Response:**
```json
{
  "id": 1,
  "code": "CSCI 0300",
  "title": "Fundamentals of Computer Systems",
  "department": "CSCI",
  "description": null
}
```

### Get Course Offerings
```
GET /courses/:id/offerings
```
Returns all offerings (semester + professor combinations) for a course.

**Response:**
```json
[
  {
    "id": 1,
    "professor": "Tom Doeppner",
    "semester": "202420",
    "section": "S01",
    "meeting_times": "MWF 10-10:50a",
    "rating": 1532,
    "comparison_count": 45
  },
  {
    "id": 2,
    "professor": "Tom Doeppner",
    "semester": "202320",
    "section": "S01",
    "meeting_times": "MWF 10-10:50a",
    "rating": 1498,
    "comparison_count": 23
  }
]
```

---

## User Course Tracking

### Get User's Course Offerings
```
GET /users/:id/courses
```
Returns list of course offerings the user has taken.

**Response:**
```json
[
  {
    "offering_id": 1,
    "course_id": 1,
    "code": "CSCI 0300",
    "title": "Fundamentals of Computer Systems",
    "department": "CSCI",
    "professor": "Tom Doeppner",
    "semester": "202420",
    "section": "S01",
    "added_at": "2024-01-15T10:35:00.000Z"
  }
]
```

### Add Course Offering to User's List
```
POST /users/:id/courses
```
Adds a specific course offering to user's taken list.

**Request Body:**
```json
{
  "offering_id": 1
}
```

**Response:**
```json
{
  "id": 1,
  "user_id": 1,
  "offering_id": 1,
  "added_at": "2024-01-15T10:35:00.000Z"
}
```

### Remove Course Offering from User's List
```
DELETE /users/:id/courses/:offering_id
```
Removes a course offering from the user's list.

**Response:**
```json
{
  "success": true
}
```

---

## Pairwise Comparison Flow

### Get Next Comparison
```
GET /users/:id/compare/next
```
Returns a pair of course offerings the user has taken but not yet compared.

**Logic:**
- Fetches all offerings the user has taken
- Finds all 2-combinations of those offerings
- Excludes pairs already compared
- Returns a random unpaired combination

**Response:**
```json
{
  "offering_a": {
    "id": 1,
    "code": "CSCI 0300",
    "title": "Fundamentals of Computer Systems",
    "professor": "Tom Doeppner",
    "semester": "202420",
    "section": "S01"
  },
  "offering_b": {
    "id": 5,
    "code": "ENGL 0150",
    "title": "Introduction to Literary Studies",
    "professor": "Jane Smith",
    "semester": "202420",
    "section": "S01"
  },
  "remaining_comparisons": 15
}
```

If all pairs have been compared:
```json
{
  "message": "All course offering pairs have been compared"
}
```

### Submit Comparison
```
POST /users/:id/compare
```
Records a pairwise comparison between two offerings and updates Elo ratings.

**Request Body:**
```json
{
  "offering_a_id": 1,
  "offering_b_id": 5,
  "winner_offering_id": 1
}
```

**Response:**
```json
{
  "id": 1,
  "user_id": 1,
  "offering_a_id": 1,
  "offering_b_id": 5,
  "winner_offering_id": 1,
  "compared_at": "2024-01-15T10:40:00.000Z"
}
```

---

## Health Check

```
GET /health
```
Simple health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

---

## Data Model

### Key Distinctions

- **Course**: Canonical identity (e.g., "CSCI 0300 - Fundamentals of Computer Systems")
- **Offering**: Specific instance (e.g., CSCI 0300 taught by Doeppner in Fall 2024)

### Why This Matters

Students compare **offerings**, not abstract courses. This allows you to:
- Track that "Serre's AI class was better than last year's"
- Compare different professors teaching the same course
- Aggregate offering ratings to get course-level rankings

### Future Analytics

With this structure you can answer:
- Which professor's offering of a course is most popular?
- How do course ratings change over time?
- What's the best-rated course overall (aggregating all offerings)?
