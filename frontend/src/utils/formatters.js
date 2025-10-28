/**
 * Format a semester code (YYYYSS) into a readable string
 * Database uses academic year encoding:
 * - 202310 = Fall 2023 (display as Fall 2023)
 * - 202320 = Spring 2024 (display as Spring 2024, add +1 year)
 * - 202410 = Fall 2024 (display as Fall 2024)
 *
 * @param {string} semester - Semester code (e.g., '202320' = Spring 2024)
 * @returns {string} Formatted semester (e.g., 'Spring 2024')
 */
export function formatSemester(semester) {
  if (!semester) return '';
  const year = parseInt(semester.substring(0, 4));
  const term = semester.substring(4);
  const termMap = { '10': 'Fall', '20': 'Spring', '30': 'Summer' };

  // Spring and Summer are stored with academic year, so add +1 to display calendar year
  let displayYear = year;
  if (term === '20' || term === '30') {
    displayYear += 1;
  }

  return `${termMap[term] || term} ${displayYear}`;
}
