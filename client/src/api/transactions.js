import api from './client.js';

function toDateTimeString(dateStr, endOfDay = false) {
  if (!dateStr) return undefined;
  const base = dateStr.includes('T') ? dateStr : `${dateStr}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`;
  return base + (base.includes('Z') || base.includes('+') ? '' : 'Z');
}

export const transactionsApi = {
  list: (params = {}) => {
    const { dateFrom, dateTo, ...rest } = params;
    const queryParams = {};
    for (const [key, val] of Object.entries(rest)) {
      if (val !== '' && val !== undefined && val !== null) {
        queryParams[key] = val;
      }
    }
    if (dateFrom) queryParams.startDate = toDateTimeString(dateFrom, false);
    if (dateTo) queryParams.endDate = toDateTimeString(dateTo, true);
    return api.get('/transactions', { params: queryParams });
  },

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