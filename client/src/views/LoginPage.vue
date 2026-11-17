<template>
  <div class="login-page">
    <div class="auth-card">
      <h2 class="card-title" style="text-align:center">登录</h2>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label class="form-label">用户名</label>
          <input
            v-model="username"
            class="form-input"
            placeholder="请输入用户名"
            autocomplete="username"
          />
        </div>
        <div class="form-group">
          <label class="form-label">密码</label>
          <input
            v-model="password"
            class="form-input"
            type="password"
            placeholder="请输入密码"
            autocomplete="current-password"
          />
        </div>
        <p v-if="errorMsg" class="form-error">{{ errorMsg }}</p>
        <button class="btn btn-primary btn-block" type="submit" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>
      <p class="auth-link">
        没有账号？<router-link to="/register">去注册</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const router = useRouter();
const auth = useAuthStore();

const username = ref('');
const password = ref('');
const errorMsg = ref('');
const loading = ref(false);

async function handleLogin() {
  errorMsg.value = '';
  if (!username.value.trim() || !password.value) {
    errorMsg.value = '请输入用户名和密码';
    return;
  }

  loading.value = true;
  try {
    await auth.login(username.value.trim(), password.value);
    router.push('/');
  } catch (err) {
    errorMsg.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  justify-content: center;
  padding-top: 60px;
}

.auth-card {
  background: #fff;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  width: 100%;
  max-width: 400px;
}

.btn-block {
  width: 100%;
  padding: 10px 0;
  font-size: 15px;
  margin-top: 8px;
}

.auth-link {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: #888;
}

.auth-link a {
  color: #409EFF;
  text-decoration: none;
}

.auth-link a:hover {
  text-decoration: underline;
}
</style>
