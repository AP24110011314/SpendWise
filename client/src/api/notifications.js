import api from './client.js';

export const notificationsApi = {
  list: (params) =>
    api.get('/notifications', { params }),

  markRead: (id) =>
    api.patch(`/notifications/${id}/read`),

  markAllRead: () =>
    api.post('/notifications/read-all'),
};