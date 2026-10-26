import api from './client.js';

export const budgetsApi = {
  list: (params = {}) => {
    const { month, ...rest } = params;
    const queryParams = {};
    if (month) queryParams.month = month;
    for (const [key, val] of Object.entries(rest)) {
      if (val !== '' && val !== undefined && val !== null) {
        queryParams[key] = val;
      }
    }
    return api.get('/budgets', { params: queryParams });
  },

  create: (data) =>
    api.post('/budgets', data),

  update: (id, data) =>
    api.patch(`/budgets/${id}`, data),

  delete: (id) =>
    api.delete(`/budgets/${id}`),

  progress: (params = {}) => {
    const { month, ...rest } = params;
    const queryParams = {};
    if (month) queryParams.month = month;
    for (const [key, val] of Object.entries(rest)) {
      if (val !== '' && val !== undefined && val !== null) {
        queryParams[key] = val;
      }
    }
    return api.get('/budgets/progress', { params: queryParams });
  },

  copy: (fromMonth, toMonth) => {
    const payload = typeof fromMonth === 'object' && fromMonth !== null ? fromMonth : { fromMonth, toMonth };
    return api.post('/budgets/copy', payload);
  },
};