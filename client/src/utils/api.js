import { useAuthStore } from '../stores/auth.js';

export async function api(url, options = {}) {
  const auth = useAuthStore();
  const headers = { ...options.headers };
  if (auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    auth.logout();
    window.location.href = '/login';
    throw new Error('未登录');
  }
  return res;
}
