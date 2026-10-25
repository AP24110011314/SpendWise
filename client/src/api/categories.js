import api from './client.js';

export const categoriesApi = {
  list: (type) =>
    api.get('/categories', { params: { type } }),

  create: (data) =>
    api.post('/categories', data),

  update: (id, data) =>
    api.patch(`/categories/${id}`, data),

  delete: (id, reassignTo) =>
    api.delete(`/categories/${id}`, { params: { reassignTo } }),
};