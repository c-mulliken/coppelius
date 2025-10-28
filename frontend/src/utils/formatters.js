/**
 * Format a semester code (YYYYSS) into a readable string
 * The database stores semester codes as-is from CAB scraping:
 * - 202310 = Fall 2023
 * - 202420 = Spring 2024
 * - 202510 = Fall 2025
 *
 * @param {string} semester - Semester code (e.g., '202420' = Spring 2024)
 * @returns {string} Formatted semester (e.g., 'Spring 2024')
 */
export function formatSemester(semester) {
  if (!semester) return '';
  const year = parseInt(semester.substring(0, 4));
  const term = semester.substring(4);
  const termMap = { '10': 'Fall', '20': 'Spring', '30': 'Summer' };

  return `${termMap[term] || term} ${year}`;
}
