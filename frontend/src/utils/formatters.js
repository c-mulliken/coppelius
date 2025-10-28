/**
 * Format a semester code (YYYYSS) into a readable string
 * Brown uses academic year encoding:
 * - 202310 = Fall 2023
 * - 202320 = Spring 2024 (part of academic year 2023-2024)
 * - 202330 = Summer 2024 (part of academic year 2023-2024)
 *
 * @param {string} semester - Semester code (e.g., '202320' = Spring 2024)
 * @returns {string} Formatted semester (e.g., 'Spring 2024')
 */
export function formatSemester(semester) {
  if (!semester) return '';
  const academicYear = parseInt(semester.substring(0, 4));
  const term = semester.substring(4);
  const termMap = { '10': 'Fall', '20': 'Spring', '30': 'Summer' };

  // For Spring and Summer, add 1 to academic year to get calendar year
  // 202320 = Spring of academic year 2023-2024 = Spring 2024
  let displayYear = academicYear;
  if (term === '20' || term === '30') {
    displayYear += 1;
  }

  return `${termMap[term] || term} ${displayYear}`;
}
