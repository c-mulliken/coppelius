import axios from 'axios';

// In production, use /api proxy. In dev, use localhost
const API_BASE_URL = import.meta.env.VITE_API_URL ||
                     (import.meta.env.PROD ? '/api' : 'http://localhost:3000');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable sending cookies with requests
});

export const api = {
  // Auth
  getCurrentUser: () => apiClient.get('/auth/me'),

  logout: () => apiClient.get('/auth/logout'),

  // Courses
  searchCourses: (query) => apiClient.get(`/courses`, { params: { search: query } }),

  getCourse: (id) => apiClient.get(`/courses/${id}`),

  getCourseOfferings: (courseId) => apiClient.get(`/courses/${courseId}/offerings`),

  // User courses (userId will come from authenticated session)
  getUserCourses: (userId) => apiClient.get(`/users/${userId}/courses`),

  addUserCourse: (userId, offeringId) => apiClient.post(`/users/${userId}/courses`, { offering_id: offeringId }),

  removeUserCourse: (userId, offeringId) => apiClient.delete(`/users/${userId}/courses/${offeringId}`),

  // Comparisons
  getNextComparison: (userId) => apiClient.get(`/users/${userId}/compare/next`),

  submitComparison: (userId, offeringAId, offeringBId, winnerOfferingId) => {
    return apiClient.post(`/users/${userId}/compare`, {
      offering_a_id: offeringAId,
      offering_b_id: offeringBId,
      winner_offering_id: winnerOfferingId,
    });
  },

  getUserComparisons: (userId) => apiClient.get(`/users/${userId}/comparisons`),

  // Rankings
  getUserRankings: (userId) => apiClient.get(`/users/${userId}/rankings`),
};

export default apiClient;
