const cheerio = require('cheerio');

/**
 * Parse Brown transcript HTML and extract course information
 * @param {string} htmlContent - HTML content of transcript
 * @returns {Array} Array of parsed courses
 */
function parseTranscript(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const courses = [];

  // Find all table rows that contain course data
  // Course rows have 7 columns: dept, number, section, title, grade_mode, grade, credits
  $('table[width="675"] tr').each((_, row) => {
    const cells = $(row).find('td');

    // Course rows have exactly 7 cells
    if (cells.length === 7) {
      const dept = $(cells[0]).text().trim();
      const number = $(cells[1]).text().trim();
      const section = $(cells[2]).text().trim();
      const title = $(cells[3]).text().trim();
      const gradeMode = $(cells[4]).text().trim();
      const grade = $(cells[5]).text().trim();
      const credits = $(cells[6]).text().trim();

      // Skip empty rows or rows without valid department
      if (dept && number && title) {
        courses.push({
          department: dept,
          courseNumber: number,
          section: section,
          title: title,
          gradeMode: gradeMode,
          grade: grade,
          credits: parseFloat(credits) || 0,
          code: `${dept} ${number}` // e.g., "CSCI 0190"
        });
      }
    }
  });

  return courses;
}

/**
 * Extract term information from transcript
 * @param {string} htmlContent - HTML content of transcript
 * @returns {Object} Map of course codes to their semesters
 */
function extractTermInfo(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const termMap = {};
  let currentTerm = null;

  // Find term headers (e.g., "Term: Fall 2023")
  $('table[width="675"] tr').each((_, row) => {
    const cells = $(row).find('td');

    // Check for term header
    cells.each((_, cell) => {
      const text = $(cell).text();
      const termMatch = text.match(/Term:\s+(Fall|Spring|Summer)\s+(\d{4})/);

      if (termMatch) {
        const season = termMatch[1];
        const year = termMatch[2];
        currentTerm = convertToSemesterCode(season, year);
      }
    });

    // If we have a current term and this is a course row (7 cells)
    if (currentTerm && cells.length === 7) {
      const dept = $(cells[0]).text().trim();
      const number = $(cells[1]).text().trim();

      if (dept && number) {
        const code = `${dept} ${number}`;
        termMap[code] = currentTerm;
      }
    }
  });

  return termMap;
}

/**
 * Convert season and year to semester code (format: YYYYSS)
 * Uses Brown's academic year system where:
 * - Fall 2023 = 202310 (starts academic year 2023-2024)
 * - Spring 2024 = 202320 (part of academic year 2023-2024)
 * - Summer 2024 = 202330 (part of academic year 2023-2024)
 *
 * @param {string} season - "Fall", "Spring", or "Summer"
 * @param {string} year - Calendar year (e.g., "2024" for Spring 2024)
 * @returns {string} Semester code (e.g., "202320" for Spring 2024)
 */
function convertToSemesterCode(season, year) {
  const seasonCodes = {
    'Fall': '10',
    'Spring': '20',
    'Summer': '30'
  };

  // For Spring and Summer, subtract 1 from year to get academic year
  // Spring 2024 is part of academic year 2023-2024, so it becomes 202320
  let academicYear = parseInt(year);
  if (season === 'Spring' || season === 'Summer') {
    academicYear -= 1;
  }

  return `${academicYear}${seasonCodes[season] || '10'}`;
}

/**
 * Parse full transcript with term information
 * @param {string} htmlContent - HTML content of transcript
 * @returns {Array} Array of courses with semester info
 */
function parseTranscriptWithTerms(htmlContent) {
  const courses = parseTranscript(htmlContent);
  const termMap = extractTermInfo(htmlContent);

  // Add semester info to each course
  return courses.map(course => ({
    ...course,
    semester: termMap[course.code] || null
  }));
}

module.exports = {
  parseTranscript,
  extractTermInfo,
  convertToSemesterCode,
  parseTranscriptWithTerms
};
