import api from './client.js';

export const budgetsApi = {
  list: (month) =>
    api.get('/budgets', { params: { month } }),

  create: (data) =>
    api.post('/budgets', data),

  update: (id, data) =>
    api.patch(`/budgets/${id}`, data),

  delete: (id) =>
    api.delete(`/budgets/${id}`),

  progress: (month) =>
    api.get('/budgets/progress', { params: { month } }),

  copy: (fromMonth, toMonth) =>
    api.post('/budgets/copy', { fromMonth, toMonth }),
};