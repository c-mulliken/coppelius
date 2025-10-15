import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';

export default function OnboardingModal({ userId, onComplete }) {
  const [concentrations, setConcentrations] = useState([]);
  const [selectedConcentration, setSelectedConcentration] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getConcentrations()
      .then(response => setConcentrations(response.data))
      .catch(err => console.error('Error loading concentrations:', err));
  }, []);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => currentYear + i - 3);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedConcentration || !graduationYear) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.updateUserProfile(userId, selectedConcentration, parseInt(graduationYear));
      onComplete();
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to save profile. Please try again.');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              welcome to coppelius
            </h2>
            <p className="text-gray-500">
              tell us a bit about yourself
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                concentration
              </label>
              <select
                value={selectedConcentration}
                onChange={(e) => setSelectedConcentration(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              >
                <option value="">select your concentration</option>
                {concentrations.map(conc => (
                  <option key={conc} value={conc}>{conc}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                graduation year
              </label>
              <select
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              >
                <option value="">select your year</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-600 text-sm text-center bg-red-50 py-2 px-4 rounded-lg"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'saving...' : 'get started'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
