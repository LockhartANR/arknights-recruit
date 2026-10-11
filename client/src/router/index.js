// 路由表。
//
// 页面组件使用**动态导入**（懒加载）。这一点对首屏很重要：
// ECharts 及统计页的全部代码被打成一个独立 chunk，只有访问 /statistics 时才下载。
// 改回静态 import 会让首屏重新背上约 460 KB 的 ECharts —— 那正是之前
// 「单个 JS chunk 1256 KB」的主要来源。
//
// 注意：不要为了「看起来更简洁」把这些改回顶部静态 import。
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const routes = [
  {
    path: '/',
    name: 'input',
    component: () => import('../views/InputPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/statistics',
    name: 'statistics',
    // 单独成块：统计页依赖 ECharts，体积占首屏的大头，没必要一开始就加载。
    component: () => import('../views/StatisticsPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/records',
    name: 'records',
    component: () => import('../views/RecordsPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginPage.vue')
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/RegisterPage.vue')
  }
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
