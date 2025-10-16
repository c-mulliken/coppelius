import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { api } from './api/client';
import SearchBar from './components/SearchBar';
import SuggestedCourses from './components/SuggestedCourses';
import ComparisonView from './components/ComparisonView';
import MyRankings from './components/MyRankings';
import Login from './components/Login';
import OnboardingModal from './components/OnboardingModal';
import TranscriptUpload from './components/TranscriptUpload';

function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showRankings, setShowRankings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      // Check if token is in URL (from OAuth callback)
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      if (token) {
        // Store token and clean URL
        localStorage.setItem('coppelius_token', token);
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // Check if we have a token
      const storedToken = localStorage.getItem('coppelius_token');
      if (!storedToken) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Verify token by fetching user
      try {
        const response = await api.getCurrentUser();
        setUser(response.data);

        // Check if user has completed profile
        const profileResponse = await api.getUserProfile(response.data.id);
        setUserProfile(profileResponse.data);

        // Show onboarding if profile incomplete
        if (!profileResponse.data.concentration || !profileResponse.data.graduation_year) {
          setShowOnboarding(true);
        }
      } catch (error) {
        // Token invalid, clear it
        localStorage.removeItem('coppelius_token');
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

  const handleLogout = () => {
    localStorage.removeItem('coppelius_token');
    setUser(null);
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    // Refresh user profile
    const profileResponse = await api.getUserProfile(user.id);
    setUserProfile(profileResponse.data);
  };

  // Dev tool: Press Shift+O to reset profile and show onboarding
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.shiftKey && e.key === 'O') {
        setShowOnboarding(true);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

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
              <TranscriptUpload userId={user.id} onUploadComplete={handleAddOffering} />
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
          <div className="mt-8">
            <SuggestedCourses userId={user.id} onAddOffering={handleAddOffering} />
          </div>
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

      {/* Onboarding Modal */}
      {showOnboarding && (
        <OnboardingModal userId={user.id} onComplete={handleOnboardingComplete} />
      )}
    </div>
  );
}

export default App;
