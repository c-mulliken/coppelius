import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import ComparisonCard from './ComparisonCard';

export default function ComparisonView({ userId, refreshTrigger }) {
  const [comparisonPair, setComparisonPair] = useState(null);
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalComparisons, setTotalComparisons] = useState(0);

  const fetchNextPair = async () => {
    setLoading(true);
    setError(null);
    setWinner(null);
    try {
      const response = await api.getNextComparison(userId);
      if (response.data.message) {
        setComparisonPair(null);
        setError(response.data.message);
      } else {
        setComparisonPair(response.data);
      }
    } catch (error) {
      console.error('Error fetching comparison:', error);
      if (error.response?.status === 400) {
        setError(error.response.data.error);
        setComparisonPair(null);
      } else {
        setError('failed to load');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadComparisons = async () => {
      try {
        const comparisonsResponse = await api.getUserComparisons(userId);
        setTotalComparisons(comparisonsResponse.data.length);
      } catch (error) {
        console.error('Error fetching comparison count:', error);
      }
    };

    loadComparisons();
    fetchNextPair();
  }, [refreshTrigger, userId]);

  const handleChoice = async (selectedOffering) => {
    if (!comparisonPair || winner) return;

    const winnerOfferingId = selectedOffering.id;
    const { offering_a, offering_b } = comparisonPair;

    setWinner(winnerOfferingId);

    await new Promise((resolve) => setTimeout(resolve, 600));

    try {
      await api.submitComparison(userId, offering_a.id, offering_b.id, winnerOfferingId);
      setTotalComparisons((prev) => prev + 1);
      fetchNextPair();
    } catch (error) {
      console.error('Error submitting comparison:', error);
      setWinner(null);
    }
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!comparisonPair || winner) return;

      if (e.key === 'ArrowLeft') {
        handleChoice(comparisonPair.offering_a);
      } else if (e.key === 'ArrowRight') {
        handleChoice(comparisonPair.offering_b);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [comparisonPair, winner]);

  if (loading && !comparisonPair) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    const errorStr = typeof error === 'string' ? error : String(error);
    const isNoCourses = errorStr.includes('at least 2') || errorStr.includes('No courses');
    const isAllDone = errorStr.includes('compared all') || errorStr.includes('All course');

    return (
      <div className="text-center py-32">
        {isNoCourses ? (
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-6">📚</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              add more courses
            </h3>
            <p className="text-gray-500 mb-6">
              you need at least 2 courses to start comparing. add another one to get started!
            </p>
            <div className="inline-flex items-center gap-2 text-sm text-gray-400">
              <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
              </svg>
              <span>use the search bar above</span>
            </div>
          </div>
        ) : isAllDone ? (
          <div className="max-w-md mx-auto">
            <div className="text-6xl mb-6">🎉</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              all done!
            </h3>
            <p className="text-gray-500 mb-6">
              you've compared all your courses. add more to keep ranking!
            </p>
          </div>
        ) : (
          <p className="text-gray-400 text-lg">{errorStr}</p>
        )}
      </div>
    );
  }

  if (!comparisonPair) {
    return null;
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center mb-16"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">
          Which would you rather take again?
        </h2>
        <p className="text-sm text-gray-500 font-medium">
          use ← → or click to choose
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <AnimatePresence mode="wait">
          <ComparisonCard
            key={comparisonPair.offering_a.id}
            offering={comparisonPair.offering_a}
            onSelect={() => handleChoice(comparisonPair.offering_a)}
            isWinner={winner === comparisonPair.offering_a.id}
          />
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <ComparisonCard
            key={comparisonPair.offering_b.id}
            offering={comparisonPair.offering_b}
            onSelect={() => handleChoice(comparisonPair.offering_b)}
            isWinner={winner === comparisonPair.offering_b.id}
          />
        </AnimatePresence>
      </div>

      {totalComparisons > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mt-12 text-sm text-gray-400 font-medium"
        >
          {totalComparisons} comparison{totalComparisons !== 1 ? 's' : ''} made
        </motion.div>
      )}
    </div>
  );
}
