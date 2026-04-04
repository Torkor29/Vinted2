import axios from 'axios';
import { getInitData } from '../utils/telegram.js';

// En production sur Render, la webapp (static site) et le backend (web service)
// sont sur des domaines differents. VITE_API_URL doit pointer vers le backend.
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add Telegram initData auth to every request
api.interceptors.request.use((config) => {
  const initData = getInitData();
  if (initData) {
    config.headers.Authorization = `tma ${initData}`;
  }
  return config;
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('Auth error - initData may be expired');
    }
    return Promise.reject(error);
  },
);

export default api;
