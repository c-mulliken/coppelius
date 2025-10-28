/**
 * Format a semester code (YYYYSS) into a readable string
 * @param {string} semester - Semester code (e.g., '202410' = Fall 2024, '202520' = Spring 2025)
 * @returns {string} Formatted semester (e.g., 'Fall 2024', 'Spring 2025')
 */
export function formatSemester(semester) {
  if (!semester) return '';
  const year = parseInt(semester.substring(0, 4));
  const term = semester.substring(4);
  const termMap = { '10': 'Fall', '20': 'Spring', '30': 'Summer' };

  return `${termMap[term] || term} ${year}`;
}
