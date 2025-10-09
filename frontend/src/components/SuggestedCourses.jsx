import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import { formatSemester } from '../utils/formatters';

export default function SuggestedCourses({ userId, onAddOffering }) {
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [offerings, setOfferings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offeringsLoading, setOfferingsLoading] = useState(false);

  useEffect(() => {
    fetchSuggestions();
  }, [userId]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const response = await api.getSuggestedCourses(userId, 4);
      setSuggestions(response.data);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTileClick = async (course) => {
    if (selectedCourseId === course.id) {
      // Clicking same course again closes it
      setSelectedCourseId(null);
      setOfferings([]);
      return;
    }

    setOfferingsLoading(true);
    setSelectedCourseId(course.id);
    try {
      const response = await api.getCourseOfferings(course.id);
      setOfferings(response.data);
    } catch (error) {
      console.error('Error fetching offerings:', error);
    } finally {
      setOfferingsLoading(false);
    }
  };

  const handleOfferingClick = async (offering) => {
    try {
      await api.addUserCourse(userId, offering.id);
      onAddOffering(offering);
      // Close the offerings menu and refresh suggestions
      setSelectedCourseId(null);
      setOfferings([]);
      fetchSuggestions();
    } catch (error) {
      console.error('Error adding course:', error);
      if (error.response?.status === 400) {
        alert('already added');
      }
    }
  };

  if (loading) {
    return (
      <div className="w-full py-6">
        <div className="flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-500">suggested courses</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {suggestions.map((course) => (
          <div key={course.id} className="relative">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleTileClick(course)}
              className={`w-full p-4 rounded-xl border transition-all text-left ${
                selectedCourseId === course.id
                  ? 'bg-indigo-50 border-indigo-300 shadow-md'
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="text-sm font-medium text-gray-900 mb-1 truncate">
                {course.code}
              </div>
              <div className="text-xs text-gray-500 line-clamp-2 mb-2">
                {course.title}
              </div>
              <div className="text-xs text-gray-400">
                {course.offering_count} offering{course.offering_count !== 1 ? 's' : ''}
              </div>
            </motion.button>

            {/* Offerings dropdown */}
            <AnimatePresence>
              {selectedCourseId === course.id && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-64 overflow-y-auto"
                >
                  {offeringsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="w-5 h-5 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
                    </div>
                  ) : offerings.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-400 text-center">
                      no offerings available
                    </div>
                  ) : (
                    offerings.map((offering) => (
                      <div
                        key={offering.id}
                        onClick={() => handleOfferingClick(offering)}
                        className="px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-b-0 transition-colors"
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {offering.professor} • {formatSemester(offering.semester)}
                        </div>
                        {offering.meeting_times && (
                          <div className="text-xs text-gray-500 mt-1">{offering.meeting_times}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          rating: {Math.round(offering.rating)}
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
