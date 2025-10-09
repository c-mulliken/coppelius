/**
 * Format a semester code (YYYYSS) into a readable string
 * Spring classes occur in the following calendar year
 * @param {string} semester - Semester code (e.g., '202410' = Fall 2024, '202420' = Spring 2025)
 * @returns {string} Formatted semester (e.g., 'Fall 2024', 'Spring 2025')
 */
export function formatSemester(semester) {
  if (!semester) return '';
  let year = parseInt(semester.substring(0, 4));
  const term = semester.substring(4);
  const termMap = { '10': 'Fall', '20': 'Spring', '30': 'Summer' };

  // Spring classes happen in the following calendar year
  // (e.g., 202420 is Spring of 2024-2025 academic year = Spring 2025)
  if (term === '20') {
    year += 1;
  }

  return `${termMap[term] || term} ${year}`;
}
