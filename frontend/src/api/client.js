import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// User ID management (for MVP, just use hardcoded user or localStorage)
const getUserId = () => {
  let userId = localStorage.getItem('belli_user_id');
  if (!userId) {
    // For MVP, just use user ID 1
    userId = '1';
    localStorage.setItem('belli_user_id', userId);
  }
  return userId;
};

export const api = {
  // Courses
  searchCourses: (query) => apiClient.get(`/courses`, { params: { search: query } }),

  getCourse: (id) => apiClient.get(`/courses/${id}`),

  getCourseOfferings: (courseId) => apiClient.get(`/courses/${courseId}/offerings`),

  // User courses
  getUserCourses: () => {
    const userId = getUserId();
    return apiClient.get(`/users/${userId}/courses`);
  },

  addUserCourse: (offeringId) => {
    const userId = getUserId();
    return apiClient.post(`/users/${userId}/courses`, { offering_id: offeringId });
  },

  removeUserCourse: (offeringId) => {
    const userId = getUserId();
    return apiClient.delete(`/users/${userId}/courses/${offeringId}`);
  },

  // Comparisons
  getNextComparison: () => {
    const userId = getUserId();
    return apiClient.get(`/users/${userId}/compare/next`);
  },

  submitComparison: (offeringAId, offeringBId, winnerOfferingId) => {
    const userId = getUserId();
    return apiClient.post(`/users/${userId}/compare`, {
      offering_a_id: offeringAId,
      offering_b_id: offeringBId,
      winner_offering_id: winnerOfferingId,
    });
  },

  getUserComparisons: () => {
    const userId = getUserId();
    return apiClient.get(`/users/${userId}/comparisons`);
  },

  // Rankings
  getUserRankings: () => {
    const userId = getUserId();
    return apiClient.get(`/users/${userId}/rankings`);
  },
};

export default apiClient;
