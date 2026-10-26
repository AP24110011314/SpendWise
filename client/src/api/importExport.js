import api from './client.js';

export const importExportApi = {
  preview: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  commit: (file, payload = {}) => {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    const mapping = payload.mapping || payload.options || payload;
    formData.append('mapping', typeof mapping === 'string' ? mapping : JSON.stringify(mapping));
    if (payload.previewRows) {
      formData.append(
        'previewRows',
        typeof payload.previewRows === 'string'
          ? payload.previewRows
          : JSON.stringify(payload.previewRows)
      );
    }
    return api.post('/import/commit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  batches: () =>
    api.get('/import/batches'),

  undo: (id) =>
    api.delete(`/import/batches/${id}`),

  export: (params) =>
    api.get('/import/transactions.csv', { params, responseType: 'blob' }),
};