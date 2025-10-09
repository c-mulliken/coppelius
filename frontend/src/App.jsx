import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { api } from './api/client';
import SearchBar from './components/SearchBar';
import ComparisonView from './components/ComparisonView';
import MyRankings from './components/MyRankings';
import Login from './components/Login';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showRankings, setShowRankings] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await api.getCurrentUser();
        setUser(response.data);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleAddOffering = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen app-container">
      {/* Header */}
      <header className="border-b border-gray-100 header-full-width">
        <div className="container mx-auto max-w-5xl py-10">
          <div className="flex items-center justify-between mb-10">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              coppelius
            </h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowRankings(true)}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 px-5 py-2.5 rounded-full transition-all shadow-sm hover:shadow"
              >
                my courses
              </button>
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                logout
              </button>
            </div>
          </div>
          <SearchBar userId={user.id} onAddOffering={handleAddOffering} />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-5xl py-20">
        <ComparisonView userId={user.id} refreshTrigger={refreshTrigger} />
      </main>

      {/* Rankings Modal */}
      <AnimatePresence>
        {showRankings && <MyRankings userId={user.id} onClose={() => setShowRankings(false)} />}
      </AnimatePresence>
    </div>
  );
}

export default App;
