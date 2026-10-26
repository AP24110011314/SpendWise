import api from './client.js';

export const notificationsApi = {
  list: (params) =>
    api.get('/budgets/notifications', { params }),

  markRead: (id) =>
    api.patch(`/budgets/notifications/${id}/read`),

  markAllRead: () =>
    api.post('/budgets/notifications/read-all'),
};