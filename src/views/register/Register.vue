<template>
  <div class="register-page">
    <div class="register-layout">
      <section class="brand-panel">
        <p class="brand-tag">SMART MALL</p>
        <h1 class="brand-title">开启你的品质购物之旅</h1>
        <p class="brand-subtitle">新会员注册即可体验更快下单、订单追踪和专属福利。</p>
        <ul class="brand-points">
          <li>新人专享礼包</li>
          <li>订单与售后全程可视化</li>
          <li>收藏与足迹多端同步</li>
        </ul>
      </section>

      <section class="form-panel">
        <div class="form-card">
          <h2 class="form-title">创建账号</h2>
          <p class="form-tip">仅需一分钟，立即加入 Smart Mall</p>

          <form @submit.prevent="handleRegister">
            <div class="form-group">
              <label for="username">用户名</label>
              <input
                type="text"
                id="username"
                v-model="registerForm.username"
                required
                placeholder="请输入用户名"
              />
            </div>

            <div class="form-group">
              <label for="password">密码</label>
              <input
                type="password"
                id="password"
                v-model="registerForm.password"
                required
                placeholder="请设置密码（至少8位，包含字母和数字）"
                pattern="(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}"
                title="密码至少8位，必须包含字母和数字"
              />
            </div>

            <div class="form-group">
              <label for="email">邮箱</label>
              <div class="email-input-group">
                <input
                  type="email"
                  id="email"
                  v-model="registerForm.email"
                  required
                  placeholder="请输入邮箱地址"
                />
                <button
                  type="button"
                  class="send-code-btn"
                  :disabled="cooldown > 0"
                  @click="handleSendCode"
                >
                  {{ cooldown > 0 ? `${cooldown}s` : '发送验证码' }}
                </button>
              </div>
            </div>

            <div class="form-group">
              <label for="code">验证码</label>
              <input
                type="text"
                id="code"
                v-model="registerForm.code"
                required
                placeholder="请输入邮箱验证码"
              />
            </div>

            <button class="submit-btn" type="submit" :disabled="loading">
              {{ loading ? '注册中...' : '注册并登录' }}
            </button>

            <div class="error-msg" v-if="errorMessage">{{ errorMessage }}</div>
            <div class="success-msg" v-if="successMessage">{{ successMessage }}</div>
          </form>

          <div class="footer">
            <p>已有账号？<router-link to="/login">立即登录</router-link></p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { authRegister, sendCode, type UserRegister } from '@/api/auth'

defineOptions({ name: 'RegisterPage' })

const router = useRouter()
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const cooldown = ref(0)
let timer: number | null = null

const registerForm = reactive<UserRegister>({
  username: '',
  password: '',
  email: '',
  code: '',
})

const handleSendCode = async () => {
  if (!registerForm.email) {
    errorMessage.value = '请先输入邮箱地址'
    return
  }

  if (timer) return

  try {
    errorMessage.value = ''
    await sendCode(registerForm.email)
    successMessage.value = '验证码已发送！'
    startCooldown()
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '发送验证码失败'
  }
}

const startCooldown = () => {
  cooldown.value = 60
  timer = window.setInterval(() => {
    cooldown.value--
    if (cooldown.value <= 0) {
      resetCooldown()
    }
  }, 1000)
}

const resetCooldown = () => {
  cooldown.value = 0
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

const handleRegister = async () => {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const res = await authRegister(registerForm)
    const registerSuccess =
      res?.code === '0' || res?.code === 0 || res?.code === '200' || res?.code === 200

    if (registerSuccess) {
      successMessage.value = '注册成功！正在跳转...'
      setTimeout(() => {
        router.push('/login')
      }, 800)
    } else {
      errorMessage.value = res.msg || '注册失败'
      resetCooldown()
    }
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '注册时发生错误'
    resetCooldown()
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  padding: 28px;
  background:
    radial-gradient(circle at 0 0, #fff1dd 0, transparent 38%),
    radial-gradient(circle at 100% 100%, #d8ecff 0, transparent 35%), #f6f8fc;
}

.register-layout {
  max-width: 1120px;
  min-height: calc(100vh - 56px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 480px;
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
  font-size: 42px;
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
  padding: 34px 30px;
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

.email-input-group {
  display: flex;
  gap: 8px;
}

.email-input-group input {
  flex: 1;
  min-width: 0;
}

.send-code-btn {
  white-space: nowrap;
  padding: 0 14px;
  min-width: 108px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #36bc89, #20a576);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
  flex-shrink: 0;
}

.send-code-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 9px 18px rgba(50, 178, 128, 0.28);
}

.send-code-btn:disabled {
  background: #b9d8c9;
  cursor: not-allowed;
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

.success-msg {
  color: #67c23a;
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
  .register-page {
    padding: 16px;
  }

  .register-layout {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .brand-panel {
    padding: 26px 22px;
  }

  .brand-title {
    font-size: 30px;
  }

  .form-card {
    padding: 26px 20px;
  }
}

@media (max-width: 520px) {
  .email-input-group {
    flex-direction: column;
  }

  .send-code-btn {
    width: 100%;
    height: 42px;
  }
}
</style>
