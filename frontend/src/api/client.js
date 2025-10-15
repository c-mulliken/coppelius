import axios from 'axios';

// Determine API URL based on environment
const getApiUrl = () => {
  // If explicitly set, use that
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Local development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  // Production - use Vercel proxy
  return '/api';
};

const API_BASE_URL = getApiUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('coppelius_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // Auth
  getCurrentUser: () => apiClient.get('/auth/me'),

  logout: () => apiClient.get('/auth/logout'),

  // Courses
  searchCourses: (query) => apiClient.get(`/courses`, { params: { search: query } }),

  getCourse: (id) => apiClient.get(`/courses/${id}`),

  getCourseOfferings: (courseId) => apiClient.get(`/courses/${courseId}/offerings`),

  getSuggestedCourses: (userId, limit = 4) => apiClient.get(`/courses/suggestions/for-user`, { params: { user_id: userId, limit } }),

  // User profile
  getUserProfile: (userId) => apiClient.get(`/users/${userId}`),

  updateUserProfile: (userId, concentration, graduationYear) => apiClient.patch(`/users/${userId}`, { concentration, graduation_year: graduationYear }),

  getConcentrations: () => apiClient.get(`/users/concentrations`),

  // User courses (userId will come from authenticated session)
  getUserCourses: (userId) => apiClient.get(`/users/${userId}/courses`),

  addUserCourse: (userId, offeringId) => apiClient.post(`/users/${userId}/courses`, { offering_id: offeringId }),

  removeUserCourse: (userId, offeringId) => apiClient.delete(`/users/${userId}/courses/${offeringId}`),

  // Comparisons
  getNextComparison: (userId) => apiClient.get(`/users/${userId}/compare/next`),

  submitComparison: (userId, offeringAId, offeringBId, winnerOfferingId, category) => {
    return apiClient.post(`/users/${userId}/compare`, {
      offering_a_id: offeringAId,
      offering_b_id: offeringBId,
      winner_offering_id: winnerOfferingId,
      category,
    });
  },

  getUserComparisons: (userId) => apiClient.get(`/users/${userId}/comparisons`),

  undoLastComparison: (userId) => apiClient.delete(`/users/${userId}/compare/last`),

  // Rankings
  getUserRankings: (userId) => apiClient.get(`/users/${userId}/rankings`),
};

export default apiClient;
