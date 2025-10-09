require('dotenv').config();
const express = require('express');
const cors = require('cors');
const usersRouter = require('./routes/users');
const coursesRouter = require('./routes/courses');
const comparisonsRouter = require('./routes/comparisons');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/users', usersRouter);
app.use('/courses', coursesRouter);
app.use('/', comparisonsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Belli API server running on port ${PORT}`);
});
