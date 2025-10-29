import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function GradeDistribution({ offeringId, userId }) {
  const [distribution, setDistribution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDistribution();
  }, [offeringId, userId]);

  const fetchDistribution = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'https://coppelius-production.up.railway.app';
      const response = await fetch(
        `${apiUrl}/courses/offerings/${offeringId}/grade-distribution?user_id=${userId}`
      );
      const data = await response.json();

      if (!response.ok) {
        if (data.requires_transcript) {
          setError('Upload your transcript to view grade distributions');
        } else {
          setError(data.error || 'Failed to load grade distribution');
        }
        setLoading(false);
        return;
      }

      setDistribution(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching grade distribution:', err);
      setError('Failed to load grade distribution');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-xs text-gray-400 italic">
        Loading grades...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-amber-600 italic">
        {error}
      </div>
    );
  }

  if (!distribution || !distribution.available) {
    return (
      <div className="text-xs text-gray-400 italic">
        {distribution?.message || 'No grade data available'}
      </div>
    );
  }

  // Simple bar chart visualization
  return (
    <div className="mt-3 space-y-1">
      <div className="text-xs font-medium text-gray-600 mb-2">
        Grade Distribution ({distribution.total_grades} students)
      </div>
      {distribution.distribution.map((item) => (
        <div key={item.grade} className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-600 w-8">
            {item.grade}
          </span>
          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full flex items-center justify-end pr-2"
              style={{ width: `${item.percentage}%` }}
            >
              {parseFloat(item.percentage) > 15 && (
                <span className="text-xs text-white font-medium">
                  {item.percentage}%
                </span>
              )}
            </div>
          </div>
          {parseFloat(item.percentage) <= 15 && (
            <span className="text-xs text-gray-500 w-12 text-right">
              {item.percentage}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
