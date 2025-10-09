const axios = require('axios');

const CAB_API_URL = process.env.CAB_API_URL || 'https://cab.brown.edu/api/';

/**
 * Fetch course details including description from Brown CAB API
 * @param {string} crn - Course Reference Number
 * @param {string} courseCode - Course code (e.g., "HIST 0150A")
 * @param {string} srcdb - Source database/semester (e.g., "202510")
 * @returns {Promise<Object>} Course details including description
 */
async function fetchCourseDetails(crn, courseCode, srcdb) {
  const params = {
    page: 'fose',
    route: 'details'
  };

  const payload = {
    group: `code:${courseCode}`,
    key: `crn:${crn}`,
    srcdb: srcdb,
    matched: `crn:${crn}`,
    userWithRolesStr: '!!!!!!'
  };

  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  };

  try {
    const response = await axios.post(CAB_API_URL, payload, { params, headers });

    if (response.status === 200 && response.data) {
      return {
        description: response.data.description || null,
        title: response.data.title || null,
        credits: response.data.credits_html || null,
        instructor: response.data.instructordetail_html || null,
        meeting: response.data.meeting_html || null
      };
    }

    return null;
  } catch (error) {
    console.error(`Error fetching details for CRN ${crn}:`, error.message);
    return null;
  }
}

/**
 * Strip HTML tags from a string
 * @param {string} html - HTML string
 * @returns {string} Plain text
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

/**
 * Fetch and return clean course description
 * @param {string} crn - Course Reference Number
 * @param {string} courseCode - Course code
 * @param {string} srcdb - Source database/semester
 * @returns {Promise<string|null>} Plain text description
 */
async function fetchCourseDescription(crn, courseCode, srcdb) {
  const details = await fetchCourseDetails(crn, courseCode, srcdb);
  if (!details || !details.description) {
    return null;
  }
  return stripHtml(details.description);
}

module.exports = {
  fetchCourseDetails,
  fetchCourseDescription,
  stripHtml
};
