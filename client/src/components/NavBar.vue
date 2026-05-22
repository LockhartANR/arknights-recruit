<template>
  <nav class="navbar">
    <div class="navbar-brand">明日方舟公招统计</div>
    <div class="navbar-links">
      <router-link to="/" class="nav-link" active-class="active" exact>录入</router-link>
      <router-link to="/records" class="nav-link" active-class="active">记录</router-link>
      <router-link to="/statistics" class="nav-link" active-class="active">统计</router-link>
    </div>
    <div v-if="auth.isLoggedIn" class="navbar-user">
      <span class="username">{{ auth.user?.username }}</span>
      <button class="btn btn-sm btn-logout" @click="handleLogout">退出</button>
    </div>
  </nav>
</template>

<script setup>
import { useAuthStore } from '../stores/auth.js';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const router = useRouter();

function handleLogout() {
  auth.logout();
  router.push('/login');
}
</script>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: #1a1a2e;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.navbar-brand {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 1px;
}
.navbar-links {
  display: flex;
  gap: 8px;
  margin-left: auto;
  margin-right: 20px;
}
.nav-link {
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s;
}
.nav-link:hover {
  color: #fff;
  background: rgba(255,255,255,0.1);
}
.nav-link.active {
  color: #fff;
  background: rgba(255,255,255,0.2);
  font-weight: 600;
}
.navbar-user {
  display: flex;
  align-items: center;
  gap: 12px;
}
.username {
  font-size: 14px;
  color: rgba(255,255,255,0.85);
}
.btn-logout {
  background: rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.85);
  border: none;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
}
.btn-logout:hover {
  background: rgba(255,255,255,0.25);
  color: #fff;
}
</style>
