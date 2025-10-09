import { motion } from 'framer-motion';

export default function ComparisonCard({ offering, onSelect, isWinner }) {
  if (!offering) return null;

  return (
    <motion.div
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
      }}
      exit={{ scale: 0.96, opacity: 0 }}
      whileHover={{ y: -4 }}
      onClick={onSelect}
      className={`
        relative bg-white rounded-2xl p-10 cursor-pointer
        transition-all duration-300
        ${isWinner
          ? 'ring-2 ring-indigo-500 shadow-xl'
          : 'shadow-md hover:shadow-xl'
        }
      `}
    >
      <div className="space-y-5">
        <div>
          <h3 className="text-xl font-bold text-gray-900 tracking-tight">{offering.code}</h3>
          <p className="text-gray-600 mt-2 leading-relaxed">{offering.title}</p>
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span className="font-medium">{offering.professor || 'TBD'}</span>
          <span className="text-gray-300">•</span>
          <span>{formatSemester(offering.semester)}</span>
        </div>

        {offering.meeting_times && (
          <div className="text-sm text-gray-400">{offering.meeting_times}</div>
        )}
      </div>

      {isWinner && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-8 right-8"
        >
          <div className="w-7 h-7 bg-indigo-500 rounded-full flex items-center justify-center">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function formatSemester(semester) {
  if (!semester) return '';

  const year = semester.substring(0, 4);
  const term = semester.substring(4);

  const termMap = {
    '10': 'Fall',
    '20': 'Spring',
    '30': 'Summer',
  };

  return `${termMap[term] || term} ${year}`;
}
