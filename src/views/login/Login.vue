<template>
  <div class="login-page">
    <div class="login-layout">
      <section class="brand-panel">
        <p class="brand-tag">SMART MALL</p>
        <h1 class="brand-title">欢迎回来</h1>
        <p class="brand-subtitle">登录后即可查看订单动态、管理收货地址，并享受你的专属优惠。</p>
        <ul class="brand-points">
          <li>订单状态实时更新</li>
          <li>购物车与收藏跨端同步</li>
          <li>会员权益一键触达</li>
        </ul>
      </section>

      <section class="form-panel">
        <div class="form-card">
          <h2 class="form-title">账号登录</h2>
          <p class="form-tip">输入账号信息，继续你的购物体验</p>

          <form @submit.prevent="handleLogin">
            <div class="form-group">
              <label for="username">用户名</label>
              <input
                type="text"
                id="username"
                v-model="loginForm.username"
                required
                placeholder="请输入用户名"
              />
            </div>

            <div class="form-group">
              <label for="password">密码</label>
              <input
                type="password"
                id="password"
                v-model="loginForm.password"
                required
                placeholder="请输入密码"
              />
            </div>

            <button class="submit-btn" type="submit" :disabled="loading">
              {{ loading ? '登录中...' : '立即登录' }}
            </button>

            <div class="social-login">
              <p class="social-title">社交登录</p>
              <button
                class="social-icon-btn"
                type="button"
                @click="handleGithubLogin"
                title="GitHub 登录"
              >
                <img src="/svg/github.svg" alt="GitHub 登录" />
              </button>
            </div>

            <div class="error-msg" v-if="errorMessage">{{ errorMessage }}</div>
          </form>

          <div class="footer">
            <p>还没有账号？<router-link to="/register">立即注册</router-link></p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { authLogin, type UserLogin } from '@/api/auth'

defineOptions({ name: 'LoginPage' })

const router = useRouter()
const loading = ref(false)
const errorMessage = ref('')

const loginForm = reactive<UserLogin>({
  username: '',
  password: '',
})

const handleLogin = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await authLogin(loginForm)
    if (res.code === '0') {
      router.push('/')
    } else {
      errorMessage.value = res.msg || '登录失败'
    }
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '登录时发生错误'
  } finally {
    loading.value = false
  }
}

const handleGithubLogin = () => {
  window.location.href = '/api/auth/oauth2/authorization/github'
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  padding: 28px;
  background:
    radial-gradient(circle at 0 0, #fff1dd 0, transparent 38%),
    radial-gradient(circle at 100% 100%, #d8ecff 0, transparent 35%), #f6f8fc;
}

.login-layout {
  max-width: 1120px;
  min-height: calc(100vh - 56px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 460px;
  gap: 22px;
}

.brand-panel {
  color: #183153;
  padding: 48px 40px;
  border-radius: 24px;
  background: linear-gradient(145deg, #ffffff 0%, #f4f7ff 100%);
  border: 1px solid #e7edf8;
  box-shadow: 0 18px 45px rgba(18, 40, 72, 0.08);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.brand-tag {
  align-self: flex-start;
  margin: 0 0 18px;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: #1178ea;
  padding: 7px 12px;
  border-radius: 999px;
  background: #eaf3ff;
  font-weight: 700;
}

.brand-title {
  margin: 0;
  font-size: 44px;
  line-height: 1.2;
  font-weight: 800;
}

.brand-subtitle {
  margin: 18px 0 0;
  font-size: 16px;
  line-height: 1.8;
  color: #4e6481;
}

.brand-points {
  list-style: none;
  padding: 0;
  margin: 28px 0 0;
  display: grid;
  gap: 12px;
}

.brand-points li {
  position: relative;
  padding-left: 24px;
  color: #2c476f;
}

.brand-points li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #30bb83;
}

.form-panel {
  display: flex;
  align-items: center;
}

.form-card {
  width: 100%;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e8edf7;
  box-shadow: 0 18px 42px rgba(18, 40, 72, 0.12);
  padding: 36px 30px;
}

.form-title {
  margin: 0;
  text-align: center;
  font-size: 30px;
  color: #1c324f;
  font-weight: 800;
}

.form-tip {
  margin: 10px 0 24px;
  text-align: center;
  color: #667c99;
  font-size: 14px;
}

.form-group {
  margin-bottom: 14px;
}

label {
  display: block;
  margin-bottom: 8px;
  color: #446184;
  font-size: 13px;
  font-weight: 700;
}

input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border: 1px solid #dbe5f3;
  border-radius: 12px;
  background: #f8fbff;
  font-size: 14px;
  color: #223b59;
  box-sizing: border-box;
  transition: all 0.22s ease;
}

input:focus {
  outline: none;
  border-color: #2994ff;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(41, 148, 255, 0.14);
}

.submit-btn {
  width: 100%;
  height: 46px;
  margin-top: 8px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #1178ea, #2f9bfd);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.social-login {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.social-title {
  margin: 0;
  color: #7a8ea8;
  font-size: 13px;
}

.social-icon-btn {
  width: 44px;
  height: 44px;
  border: 1px solid #d7e2f0;
  border-radius: 50%;
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.18s ease;
}

.social-icon-btn img {
  width: 22px;
  height: 22px;
}

.social-icon-btn:hover {
  border-color: #a8bfdc;
  background: #f5f8fc;
  transform: translateY(-1px);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 11px 23px rgba(17, 120, 234, 0.28);
}

.submit-btn:disabled {
  background: #8ab9ee;
  cursor: not-allowed;
}

.error-msg {
  color: #f56c6c;
  margin-top: 12px;
  text-align: center;
  font-size: 13px;
}

.footer {
  margin-top: 18px;
  text-align: center;
  color: #7086a3;
  font-size: 14px;
}

.footer a {
  color: #1178ea;
  text-decoration: none;
  font-weight: 700;
}

.footer a:hover {
  text-decoration: underline;
}

@media (max-width: 960px) {
  .login-page {
    padding: 16px;
  }

  .login-layout {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .brand-panel {
    padding: 26px 22px;
  }

  .brand-title {
    font-size: 32px;
  }

  .form-card {
    padding: 26px 20px;
  }
}
</style>
