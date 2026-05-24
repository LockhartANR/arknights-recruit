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

    <!-- Hamburger button (mobile only) -->
    <button
      class="hamburger"
      :class="{ open: menuOpen }"
      @click="menuOpen = !menuOpen"
    >
      <span /><span /><span />
    </button>
  </nav>

  <!-- Mobile menu overlay -->
  <Teleport to="body">
    <div v-if="menuOpen" class="mobile-menu-overlay" @click="menuOpen = false" />
    <div v-if="menuOpen" class="mobile-menu">
      <router-link to="/" class="mobile-nav-link" active-class="active" exact @click="menuOpen = false">录入</router-link>
      <router-link to="/records" class="mobile-nav-link" active-class="active" @click="menuOpen = false">记录</router-link>
      <router-link to="/statistics" class="mobile-nav-link" active-class="active" @click="menuOpen = false">统计</router-link>
      <template v-if="auth.isLoggedIn">
        <div class="mobile-menu-divider" />
        <div class="mobile-user">{{ auth.user?.username }}</div>
        <button class="btn btn-sm btn-logout mobile-logout" @click="handleLogout">退出登录</button>
      </template>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { useRouter, useRoute } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const menuOpen = ref(false)

function handleLogout() {
  menuOpen.value = false
  auth.logout()
  router.push('/login')
}

// Auto-close mobile menu on route change
watch(() => route.path, () => {
  menuOpen.value = false
})
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
  position: relative;
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

/* Hamburger */
.hamburger {
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 36px;
  height: 36px;
  padding: 8px;
  border: none;
  background: none;
  cursor: pointer;
}
.hamburger span {
  display: block;
  width: 100%;
  height: 2px;
  background: rgba(255,255,255,0.85);
  border-radius: 2px;
  transition: all 0.3s;
}
.hamburger.open span:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}
.hamburger.open span:nth-child(2) {
  opacity: 0;
}
.hamburger.open span:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}

/* Mobile menu overlay */
.mobile-menu-overlay {
  position: fixed;
  inset: 0;
  top: 56px;
  background: rgba(0,0,0,0.3);
  z-index: 90;
}

/* Mobile menu panel */
.mobile-menu {
  position: fixed;
  top: 56px;
  right: 0;
  width: 220px;
  background: #1a1a2e;
  padding: 12px 16px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-radius: 0 0 0 12px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
}
.mobile-nav-link {
  color: rgba(255,255,255,0.8);
  text-decoration: none;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 15px;
  transition: background 0.2s;
}
.mobile-nav-link:hover,
.mobile-nav-link.active {
  background: rgba(255,255,255,0.15);
  color: #fff;
}
.mobile-menu-divider {
  height: 1px;
  background: rgba(255,255,255,0.12);
  margin: 8px 0;
}
.mobile-user {
  padding: 8px 12px;
  font-size: 14px;
  color: rgba(255,255,255,0.6);
}
.mobile-logout {
  margin: 4px 0 0;
  width: 100%;
  text-align: center;
}

@media (max-width: 640px) {
  .navbar {
    padding: 0 16px;
  }
  .navbar-brand {
    font-size: 15px;
  }
}
</style>
