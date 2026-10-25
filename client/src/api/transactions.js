import api from './client.js';

export const transactionsApi = {
  list: (params) =>
    api.get('/transactions', { params }),

  get: (id) =>
    api.get(`/transactions/${id}`),

  create: (data) =>
    api.post('/transactions', data),

  update: (id, data) =>
    api.patch(`/transactions/${id}`, data),

  delete: (id) =>
    api.delete(`/transactions/${id}`),

  bulkDelete: (ids) =>
    api.post('/transactions/bulk-delete', { ids }),
};