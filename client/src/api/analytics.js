import api from './client.js';

export const analyticsApi = {
  summary: (month) =>
    api.get('/analytics/summary', { params: { month } }),

  byCategory: (params) =>
    api.get('/analytics/by-category', { params }),

  trend: (params) =>
    api.get('/analytics/trend', { params }),

  daily: (month) =>
    api.get('/analytics/daily', { params: { month } }),

  compare: (a, b) =>
    api.get('/analytics/compare', { params: { a, b } }),

  forecast: (month) =>
    api.get('/analytics/forecast', { params: { month } }),
};