import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import { formatSemester } from '../utils/formatters';
import { SEARCH_DEBOUNCE_MS } from '../utils/constants';

export default function SearchBar({ userId, onAddOffering }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [offerings, setOfferings] = useState([]);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
        setSelectedCourseId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.searchCourses(query);
        setResults(response.data);
        setIsOpen(true);
        setSelectedCourseId(null);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleCourseClick = async (course) => {
    setLoading(true);
    try {
      const response = await api.getCourseOfferings(course.id);
      setOfferings(response.data);
      setSelectedCourseId(course.id);
    } catch (error) {
      console.error('Error fetching offerings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOfferingClick = async (offering) => {
    try {
      await api.addUserCourse(userId, offering.id);
      onAddOffering(offering);
      setQuery('');
      setResults([]);
      setOfferings([]);
      setSelectedCourseId(null);
      setIsOpen(false);
    } catch (error) {
      console.error('Error adding course:', error);
      if (error.response?.status === 400) {
        alert('already added');
      }
    }
  };

  const handleBackClick = () => {
    setSelectedCourseId(null);
    setOfferings([]);
  };

  return (
    <div ref={searchRef} className="relative w-full">
      <div className="relative">
        <svg
          className="absolute left-5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search courses..."
          className="w-full pl-14 pr-5 py-4 text-base bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-gray-400 shadow-sm"
        />
        {loading && (
          <div className="absolute right-5 top-1/2 transform -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (results.length > 0 || selectedCourseId) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute z-50 w-full mt-3 bg-white border border-gray-100 rounded-2xl shadow-xl max-h-80 overflow-y-auto"
          >
            {selectedCourseId ? (
              <>
                <div className="sticky top-0 bg-white px-5 py-3 border-b border-gray-50">
                  <button
                    onClick={handleBackClick}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                  >
                    ← back
                  </button>
                </div>
                {offerings.map((offering) => (
                  <div
                    key={offering.id}
                    onClick={() => handleOfferingClick(offering)}
                    className="px-5 py-4 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {offering.professor} • {formatSemester(offering.semester)}
                        </div>
                        {offering.meeting_times && (
                          <div className="text-xs text-gray-500 mt-1">{offering.meeting_times}</div>
                        )}
                      </div>
                      <div className="text-xs font-medium text-gray-400">
                        {offering.rating}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              results.map((course) => (
                <div
                  key={course.id}
                  onClick={() => handleCourseClick(course)}
                  className="px-5 py-4 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-b-0 transition-colors"
                >
                  <div className="text-sm font-medium text-gray-900">
                    {course.code} – {course.title}
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
