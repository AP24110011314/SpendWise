import api from './client.js';

export const categoriesApi = {
  list: (type) => {
    const params = type ? { type } : {};
    return api.get('/categories', { params });
  },

  create: (data) =>
    api.post('/categories', data),

  update: (id, data) =>
    api.patch(`/categories/${id}`, data),

  delete: (id, reassignTo) => {
    const params = typeof reassignTo === 'string' && reassignTo.trim() ? { reassignTo: reassignTo.trim() } : {};
    return api.delete(`/categories/${id}`, { params });
  },
};