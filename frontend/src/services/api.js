export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const apiFetch = (path, options = {}) => {
  const token = localStorage.getItem('disasterlink_token');
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...options, headers });
};
