import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api/client';

export default function MyRankings({ onClose }) {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRankings = async () => {
      try {
        const response = await api.getUserRankings();
        setRankings(response.data);
      } catch (error) {
        console.error('Error fetching rankings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
  }, []);

  const formatSemester = (semester) => {
    if (!semester) return '';
    const year = semester.substring(0, 4);
    const term = semester.substring(4);
    const termMap = { '10': 'Fall', '20': 'Spring', '30': 'Summer' };
    return `${termMap[term] || term} ${year}`;
  };

  const getRankBadge = (position) => {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return `#${position}`;
  };

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
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">my rankings</h2>
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

        <div className="overflow-y-auto max-h-[calc(80vh-8rem)]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
            </div>
          ) : rankings.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400">no comparisons yet</p>
              <p className="text-sm text-gray-400 mt-2">start comparing courses to see rankings</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {rankings.map((ranking, index) => (
                <div
                  key={ranking.offering_id}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-2xl flex-shrink-0 w-12 text-center">
                      {getRankBadge(index + 1)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-gray-900 font-medium">
                        {ranking.code} – {ranking.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                        <span>{ranking.professor || 'TBD'}</span>
                        <span>•</span>
                        <span>{formatSemester(ranking.semester)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className="text-gray-600">
                          {ranking.wins}W - {ranking.losses}L
                        </span>
                        <span className="text-indigo-600 font-medium">
                          {ranking.win_rate}% win rate
                        </span>
                        <span className="text-gray-400">
                          rating: {Math.round(ranking.rating)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4">
          <p className="text-sm text-gray-400 text-center">
            {rankings.length} ranked course{rankings.length !== 1 ? 's' : ''}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
