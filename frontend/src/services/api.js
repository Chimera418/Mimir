import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mimir_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Optionally handle global errors (e.g., redirect on 401)
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('mimir_token');
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
