import api from './client.js';

export const importExportApi = {
  preview: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  commit: (file, options) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('options', JSON.stringify(options));
    return api.post('/import/commit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  batches: () =>
    api.get('/import/batches'),

  undo: (id) =>
    api.delete(`/import/batches/${id}`),

  export: (params) =>
    api.get('/export/transactions.csv', { params, responseType: 'blob' }),
};