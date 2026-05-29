<template>
  <div class="register-page">
    <div class="auth-card">
      <h2 class="card-title" style="text-align:center">注册</h2>
      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label class="form-label">用户名</label>
          <input
            v-model="username"
            class="form-input"
            placeholder="3-20位，字母、数字、下划线、中文"
            autocomplete="username"
          />
        </div>
        <div class="form-group">
          <label class="form-label">密码</label>
          <input
            v-model="password"
            class="form-input"
            type="password"
            placeholder="至少6位密码"
            autocomplete="new-password"
          />
        </div>
        <div class="form-group">
          <label class="form-label">确认密码</label>
          <input
            v-model="confirmPassword"
            class="form-input"
            type="password"
            placeholder="再次输入密码"
            autocomplete="new-password"
          />
        </div>
        <div class="form-group">
          <label class="form-label">邀请码</label>
          <input
            v-model="inviteCode"
            class="form-input"
            placeholder="输入邀请码"
          />
        </div>
        <p v-if="errorMsg" class="form-error">{{ errorMsg }}</p>
        <button class="btn btn-primary btn-block" type="submit" :disabled="loading">
          {{ loading ? '注册中...' : '注册' }}
        </button>
      </form>
      <p class="auth-link">
        已有账号？<router-link to="/login">去登录</router-link>
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
const confirmPassword = ref('');
const inviteCode = ref('');
const errorMsg = ref('');
const loading = ref(false);

async function handleRegister() {
  errorMsg.value = '';

  if (!username.value.trim() || !password.value) {
    errorMsg.value = '请输入用户名和密码';
    return;
  }
  if (!inviteCode.value.trim()) {
    errorMsg.value = '请输入邀请码';
    return;
  }
  if (!/^[\w\u4e00-\u9fff]{3,20}$/.test(username.value.trim())) {
    errorMsg.value = '用户名需为3-20位，仅支持字母、数字、下划线和中文';
    return;
  }
  if (password.value.length < 6) {
    errorMsg.value = '密码至少需要6位';
    return;
  }
  if (password.value !== confirmPassword.value) {
    errorMsg.value = '两次输入的密码不一致';
    return;
  }

  loading.value = true;
  try {
    await auth.register(username.value.trim(), password.value, inviteCode.value.trim());
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
.register-page {
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
