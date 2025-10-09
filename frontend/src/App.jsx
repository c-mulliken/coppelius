import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import SearchBar from './components/SearchBar';
import ComparisonView from './components/ComparisonView';
import MyRankings from './components/MyRankings';

function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showRankings, setShowRankings] = useState(false);

  const handleAddOffering = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen app-container">
      {/* Header */}
      <header className="border-b border-gray-100 header-full-width">
        <div className="container mx-auto max-w-5xl py-10">
          <div className="flex items-center justify-between mb-10">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              coppelius
            </h1>
            <button
              onClick={() => setShowRankings(true)}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 px-5 py-2.5 rounded-full transition-all shadow-sm hover:shadow"
            >
              my courses
            </button>
          </div>
          <SearchBar onAddOffering={handleAddOffering} />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-5xl py-20">
        <ComparisonView refreshTrigger={refreshTrigger} />
      </main>

      {/* Rankings Modal */}
      <AnimatePresence>
        {showRankings && <MyRankings onClose={() => setShowRankings(false)} />}
      </AnimatePresence>
    </div>
  );
}

export default App;
