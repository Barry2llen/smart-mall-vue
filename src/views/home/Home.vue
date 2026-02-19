<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authLoginByGithubCode, getCurrentUserId, logout } from '@/api/auth'

const route = useRoute()
const router = useRouter()
const userId = ref('')
const loading = ref(false)
const message = ref('')

const loadCurrentUser = async () => {
  try {
    const id = await getCurrentUserId()
    if (typeof id === 'string' && /^\s*<!doctype html>|^\s*<html[\s>]/i.test(id)) {
      userId.value = ''
      return
    }
    userId.value = id
  } catch {
    userId.value = ''
  }
}

const handleGithubCallback = async () => {
  const code = route.query.code
  const state = route.query.state

  if (typeof code !== 'string' || typeof state !== 'string') {
    return false
  }

  loading.value = true
  message.value = '正在完成 GitHub 授权登录...'
  try {
    await authLoginByGithubCode(code, state)
    await router.replace({ path: '/' })
    message.value = 'GitHub 登录成功'
    await loadCurrentUser()
  } catch (error: any) {
    message.value = error?.message || 'GitHub 登录失败'
  } finally {
    loading.value = false
  }

  return true
}

const handleLogout = async () => {
  loading.value = true
  message.value = ''
  try {
    await logout()
  } catch {
    // Some environments may not expose logout endpoint; keep local logout behavior.
  } finally {
    localStorage.removeItem('access_token')
    userId.value = ''
    loading.value = false
    message.value = '已退出登录'
    await router.push('/login')
  }
}

onMounted(async () => {
  const handled = await handleGithubCallback()
  if (!handled) {
    await loadCurrentUser()
  }
})
</script>

<template>
  <main class="home-page">
    <section class="home-card">
      <h1>Smart Mall</h1>
      <p v-if="loading">{{ message }}</p>
      <p v-else-if="userId">当前用户ID：{{ userId }}</p>
      <p v-else>当前未登录，请先 <router-link to="/login">登录</router-link></p>
      <button v-if="userId" class="logout-btn" type="button" @click="handleLogout">退出登录</button>
      <p v-if="message && !loading" class="status">{{ message }}</p>
    </section>
  </main>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);
}

.home-card {
  width: 100%;
  max-width: 720px;
  border-radius: 18px;
  border: 1px solid #e2ebf8;
  background: #fff;
  box-shadow: 0 12px 28px rgba(36, 72, 118, 0.1);
  padding: 28px;
}

h1 {
  margin: 0 0 14px;
  color: #203a5d;
  font-size: 30px;
}

p {
  margin: 8px 0;
  color: #415d80;
  font-size: 16px;
}

.status {
  color: #1178ea;
}

.logout-btn {
  margin-top: 14px;
  height: 40px;
  min-width: 120px;
  border: none;
  border-radius: 10px;
  background: #f56c6c;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.logout-btn:hover {
  background: #e45656;
}
</style>
