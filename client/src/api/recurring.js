import api from './client.js';

export const recurringApi = {
  list: () =>
    api.get('/recurring'),

  create: (data) =>
    api.post('/recurring', data),

  update: (id, data) =>
    api.patch(`/recurring/${id}`, data),

  delete: (id) =>
    api.delete(`/recurring/${id}`),

  process: () =>
    api.post('/recurring/process'),
};