import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatSemester } from '../utils/formatters';

export default function Rankings() {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [sortBy, setSortBy] = useState('rating');

  useEffect(() => {
    fetchRankings();
  }, [search, department, sortBy]);

  const fetchRankings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (department) params.append('department', department);
      if (sortBy) params.append('sort', sortBy);

      const response = await fetch(`/courses/rankings?${params}`);
      const data = await response.json();
      setRankings(data);
    } catch (error) {
      console.error('Error fetching rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique departments from rankings
  const departments = [...new Set(rankings.map(r => r.department))].sort();

  // Normalize Elo rating to 0-5 stars for display
  const normalizeRating = (elo) => {
    // Elo typically ranges from ~1200-1800 for most courses
    // Map to 0-5 stars
    const min = 1200;
    const max = 1800;
    const normalized = ((elo - min) / (max - min)) * 5;
    return Math.max(0, Math.min(5, normalized));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto max-w-5xl py-12 px-6">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Course Rankings</h1>
          <p className="text-gray-600">
            Global rankings based on student comparisons
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Course code or title..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="rating">Highest Rated</option>
                <option value="comparisons">Most Compared</option>
                <option value="code">Course Code</option>
              </select>
            </div>
          </div>
        </div>

        {/* Rankings List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        ) : rankings.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500">No courses found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rankings.map((course, index) => {
              const stars = normalizeRating(course.rating);
              const hasComparisons = course.comparison_count > 0;

              return (
                <motion.div
                  key={course.offering_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {sortBy === 'rating' && hasComparisons && (
                          <span className="text-2xl font-bold text-gray-400">
                            #{index + 1}
                          </span>
                        )}
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {course.code}
                          </h3>
                          <p className="text-gray-600 text-sm">{course.title}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-3">
                        <span className="font-medium">{course.professor || 'TBD'}</span>
                        <span>•</span>
                        <span>{formatSemester(course.semester)}</span>
                        {hasComparisons && (
                          <>
                            <span>•</span>
                            <span>{course.comparison_count} comparisons</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {hasComparisons ? (
                        <>
                          {/* Star rating */}
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <svg
                                key={i}
                                className={`w-5 h-5 ${
                                  i < Math.round(stars)
                                    ? 'text-yellow-400 fill-current'
                                    : 'text-gray-300'
                                }`}
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                          {/* Elo score */}
                          <div className="text-xs text-gray-400">
                            Elo: {Math.round(course.rating)}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-gray-400 italic">
                          Not yet ranked
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
