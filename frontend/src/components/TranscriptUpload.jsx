import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';

export default function TranscriptUpload({ userId, onUploadComplete }) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Only accept HTML files
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      alert('Please upload an HTML file');
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      // Read file contents
      const htmlContent = await file.text();

      // Upload to backend
      const response = await api.uploadTranscript(userId, htmlContent);
      setResult(response.data);

      // Refresh the UI
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload transcript. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setResult(null);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
      >
        upload transcript
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              {/* Header */}
              <div className="px-8 pt-8 pb-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">Upload Transcript</h2>
                <p className="text-sm text-gray-500 mt-2">
                  Upload your Brown transcript HTML file to automatically import all your courses
                </p>
              </div>

              {/* Content */}
              <div className="px-8 py-6">
                {!result ? (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-indigo-300 transition-colors">
                      <input
                        type="file"
                        accept=".html,.htm"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="hidden"
                        id="transcript-upload"
                      />
                      <label
                        htmlFor="transcript-upload"
                        className="cursor-pointer block"
                      >
                        {uploading ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>
                            <p className="text-sm text-gray-600">Processing transcript...</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <svg
                              className="w-12 h-12 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                              />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                Click to upload
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                HTML file only
                              </p>
                            </div>
                          </div>
                        )}
                      </label>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <p className="text-xs text-blue-900 font-medium mb-2">How to get your transcript:</p>
                      <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                        <li>Go to CAB (Courses@Brown)</li>
                        <li>Click "Display Internal Academic Record"</li>
                        <li>Save the page as HTML (File → Save Page As)</li>
                        <li>Upload the saved file here</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                      <svg
                        className="w-12 h-12 text-green-600 mx-auto mb-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <h3 className="text-lg font-bold text-green-900">Upload Complete!</h3>
                      <div className="mt-4 space-y-2 text-sm text-green-800">
                        <p>
                          <span className="font-semibold">{result.added}</span> courses added
                        </p>
                        {result.skipped > 0 && (
                          <p className="text-xs text-green-700">
                            {result.skipped} courses skipped (AP credits, transfers, etc.)
                          </p>
                        )}
                        {result.errors?.length > 0 && (
                          <p className="text-xs text-red-600">
                            {result.errors.length} errors occurred
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={handleClose}
                      className="w-full py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>

              {/* Footer */}
              {!result && (
                <div className="px-8 py-4 bg-gray-50 border-t border-gray-100">
                  <button
                    onClick={handleClose}
                    disabled={uploading}
                    className="text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
