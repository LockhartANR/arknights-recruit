import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('token')
  }),

  getters: {
    isLoggedIn: (state) => !!state.token
  },

  actions: {
    async login(username, password) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '登录失败');
      this.token = data.token;
      this.user = { id: data.id, username: data.username };
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(this.user));
    },

    async register(username, password, inviteCode) {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, inviteCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '注册失败');
    },

    async checkAuth() {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      if (!savedToken) return;

      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${savedToken}` }
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        this.token = savedToken;
        this.user = data;
      } catch {
        this.logout();
      }
    },

    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
});
