import axios from 'axios';
import { getInitData } from '../utils/telegram.js';

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Auth: prefer PWA session token, fallback to Telegram initData
api.interceptors.request.use((config) => {
  const sessionToken = localStorage.getItem('session_token');
  if (sessionToken) {
    config.headers.Authorization = `Bearer ${sessionToken}`;
    return config;
  }
  const initData = getInitData();
  if (initData) {
    config.headers.Authorization = `tma ${initData}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Session expired — clear and redirect to login hint
      localStorage.removeItem('session_token');
      localStorage.removeItem('session_expires');
    }
    return Promise.reject(error);
  },
);

export default api;
