import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import InputPage from '../views/InputPage.vue';
import StatisticsPage from '../views/StatisticsPage.vue';
import RecordsPage from '../views/RecordsPage.vue';
import LoginPage from '../views/LoginPage.vue';
import RegisterPage from '../views/RegisterPage.vue';

const routes = [
  { path: '/', name: 'input', component: InputPage, meta: { requiresAuth: true } },
  { path: '/statistics', name: 'statistics', component: StatisticsPage, meta: { requiresAuth: true } },
  { path: '/records', name: 'records', component: RecordsPage, meta: { requiresAuth: true } },
  { path: '/login', name: 'login', component: LoginPage },
  { path: '/register', name: 'register', component: RegisterPage }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, from, next) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    next('/login');
  } else if ((to.path === '/login' || to.path === '/register') && auth.isLoggedIn) {
    next('/');
  } else {
    next();
  }
});

export default router;
