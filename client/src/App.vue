<template>
  <div class="app">
    <NavBar />
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import NavBar from './components/NavBar.vue';
import { useAuthStore } from './stores/auth.js';

const auth = useAuthStore();

onMounted(() => {
  auth.checkAuth();
});
</script>
