import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import ComparisonCard from './ComparisonCard';

const CATEGORY_QUESTIONS = {
  difficulty: 'which was more difficult?',
  enjoyment: 'which did you enjoy more?',
  engagement: 'which professor was more engaging?'
};

export default function ComparisonView({ userId, refreshTrigger }) {
  const [comparisonPair, setComparisonPair] = useState(null);
  const [winner, setWinner] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalComparisons, setTotalComparisons] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);

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
        setCanUndo(comparisonsResponse.data.length > 0);
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
    const { offering_a, offering_b, category } = comparisonPair;

    setWinner(winnerOfferingId);

    await new Promise((resolve) => setTimeout(resolve, 600));

    try {
      await api.submitComparison(userId, offering_a.id, offering_b.id, winnerOfferingId, category);
      setTotalComparisons((prev) => prev + 1);
      setCanUndo(true);
      fetchNextPair();
    } catch (error) {
      console.error('Error submitting comparison:', error);
      setWinner(null);
    }
  };

  const handleSkip = () => {
    if (!comparisonPair || winner) return;
    fetchNextPair();
  };

  const handleUndo = async () => {
    if (!canUndo || undoing) return;

    setUndoing(true);
    try {
      await api.undoLastComparison(userId);
      setTotalComparisons((prev) => Math.max(0, prev - 1));
      setCanUndo((prev) => prev - 1 > 0);
      fetchNextPair();
    } catch (error) {
      console.error('Error undoing comparison:', error);
      if (error.response?.status === 404) {
        setCanUndo(false);
      }
    } finally {
      setUndoing(false);
    }
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      // Allow undo even when not in an active comparison
      if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (!comparisonPair || winner) return;

      if (e.key === 'ArrowLeft') {
        handleChoice(comparisonPair.offering_a);
      } else if (e.key === 'ArrowRight') {
        handleChoice(comparisonPair.offering_b);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [comparisonPair, winner, canUndo, undoing]);

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

  const { enough_comparisons, total_comparisons } = comparisonPair;
  const MINIMUM_COMPARISONS = 15;

  return (
    <div className="w-full max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center mb-16"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">
          {CATEGORY_QUESTIONS[comparisonPair.category]}
        </h2>
        <p className="text-sm text-gray-500 font-medium mb-2">
          use ← → to choose • ↓ or s to skip • ⌘Z to undo
        </p>

        {/* Progress indicator */}
        <div className="mt-4">
          {enough_comparisons ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              you've contributed enough! feel free to keep going or stop anytime
            </div>
          ) : (
            <div className="text-xs text-gray-400">
              {total_comparisons || 0} / {MINIMUM_COMPARISONS} comparisons • helping build global rankings
            </div>
          )}
        </div>
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

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center mt-12 flex items-center justify-center gap-4"
      >
        <button
          onClick={handleSkip}
          disabled={winner !== null}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 px-6 py-3 rounded-full transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          skip this comparison
        </button>
        {canUndo && (
          <button
            onClick={handleUndo}
            disabled={undoing}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 px-6 py-3 rounded-full transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {undoing ? 'undoing...' : 'undo last'}
          </button>
        )}
      </motion.div>

      {totalComparisons > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mt-8 text-sm text-gray-400 font-medium"
        >
          {totalComparisons} comparison{totalComparisons !== 1 ? 's' : ''} made
        </motion.div>
      )}
    </div>
  );
}
