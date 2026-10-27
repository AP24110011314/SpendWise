import axios from 'axios';

const TOKEN_KEY = 'sw_access_token';

const rawBase =
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://spendwise-9ke3.onrender.com/api' : '/api');
const baseURL = rawBase.endsWith('/api') || rawBase === '/api' ? rawBase : `${rawBase.replace(/\/$/, '')}/api`;

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token from localStorage to requests
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Ignore localStorage errors
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const resData = response.data;
    if (resData && typeof resData === 'object' && 'data' in resData) {
      // If paginated response, keep the envelope so pagination is accessible
      if ('pagination' in resData) {
        return resData;
      }
      return resData.data;
    }
    return resData;
  },
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