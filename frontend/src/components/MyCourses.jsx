import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { formatSemester } from '../utils/formatters';

export default function MyCourses({ userId, onClose }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCourses = async () => {
    try {
      const response = await api.getUserCourses(userId);
      setCourses(response.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [userId]);

  const handleDelete = async (offeringId) => {
    if (!confirm('Remove this course? All comparisons with it will be lost.')) {
      return;
    }

    try {
      await api.removeUserCourse(userId, offeringId);
      setCourses((prev) => prev.filter((c) => c.offering_id !== offeringId));
    } catch (error) {
      console.error('Error removing course:', error);
      alert('Failed to remove course');
    }
  };

  // Group courses by semester
  const coursesBySemester = courses.reduce((acc, course) => {
    const semester = course.semester;
    if (!acc[semester]) {
      acc[semester] = [];
    }
    acc[semester].push(course);
    return acc;
  }, {});

  // Sort semesters in reverse chronological order
  // Semester codes use academic year: Fall 2024 = 202410, Spring 2025 = 202520
  // But Fall 2025 = 202510, which creates a problem for simple numeric comparison
  // Chronological order: Fall 2025 > Spring 2025 > Fall 2024 > Spring 2024 > Fall 2023
  const sortedSemesters = Object.keys(coursesBySemester).sort((a, b) => {
    const yearA = parseInt(a.substring(0, 4));
    const yearB = parseInt(b.substring(0, 4));
    const termA = parseInt(a.substring(4)); // 10=Fall, 20=Spring, 30=Summer
    const termB = parseInt(b.substring(4));

    // Convert to actual chronological order
    // Fall YYYY happens in calendar year YYYY (Aug-Dec)
    // Spring YYYY happens in calendar year YYYY (Jan-May)
    // So Fall 2025 (Aug 2025) > Spring 2025 (Jan 2025)
    const calendarYearA = termA === 20 ? yearA : yearA; // Spring uses same year, Fall uses same year
    const calendarYearB = termB === 20 ? yearB : yearB;
    const calendarMonthA = termA === 10 ? 8 : (termA === 20 ? 1 : 6); // Fall=Aug, Spring=Jan, Summer=Jun
    const calendarMonthB = termB === 10 ? 8 : (termB === 20 ? 1 : 6);

    // Compare calendar dates
    if (calendarYearA !== calendarYearB) {
      return calendarYearB - calendarYearA; // Most recent year first
    }
    return calendarMonthB - calendarMonthA; // Most recent month first
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/20 flex items-center justify-center p-6 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">My Courses</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-900 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(80vh-5rem)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-2">No courses yet</p>
              <p className="text-sm">Add courses using the search bar or upload your transcript</p>
            </div>
          ) : (
            <div>
              {sortedSemesters.map((semester) => (
                <div key={semester} className="border-b border-gray-100 last:border-b-0">
                  {/* Semester Header */}
                  <div className="sticky top-0 bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700">
                      {formatSemester(semester)}
                    </h3>
                  </div>

                  {/* Courses in this semester */}
                  <div className="divide-y divide-gray-50">
                    {coursesBySemester[semester].map((course) => (
                      <div
                        key={course.offering_id}
                        className="px-6 py-4 hover:bg-gray-50 transition-colors group"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {course.code} – {course.title}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                              <span>{course.professor || 'TBD'}</span>
                              {course.section && (
                                <>
                                  <span>•</span>
                                  <span>{course.section}</span>
                                </>
                              )}
                              {course.grade && (
                                <>
                                  <span>•</span>
                                  <span className="font-medium text-gray-700">
                                    Grade: {course.grade}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(course.offering_id)}
                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                            title="Remove course"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
