import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const { response, config } = error;

    if (response?.status === 401 && !config.url?.includes('/auth/')) {
      // Don't redirect on /auth/me failure - let the component handle it
      if (!config.url?.includes('/auth/me')) {
        window.location.href = '/login';
      }
    }

    const normalizedError = {
      code: response?.data?.error?.code || 'INTERNAL',
      message: response?.data?.error?.message || 'An error occurred',
      details: response?.data?.error?.details,
      status: response?.status || 500,
    };

    return Promise.reject(normalizedError);
  }
);

export default api;