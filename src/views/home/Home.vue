<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authLoginByGithubCode, getCurrentUserId, logout } from '@/api/auth'
import { getFlashSaleSessions, type SessionVO } from '@/api/flashSale'
import {
  getCategoryTree,
  searchProducts,
  type CategoryVO,
  type Product,
  type ProductSearchParam,
} from '@/api/product'

defineOptions({ name: 'HomePage' })

const route = useRoute()
const router = useRouter()

const userId = ref('')
const authLoading = ref(false)
const authMessage = ref('')
const pageError = ref('')
const searchKeyword = ref('')

const recommendProducts = ref<Product[]>([])
const hotProducts = ref<Product[]>([])
const guessProducts = ref<Product[]>([])
const recommendLoading = ref(false)
const hotLoading = ref(false)
const guessLoading = ref(false)

const categoryTree = ref<CategoryVO[]>([])
const categoryLoading = ref(false)
const categoryError = ref('')
const categoryPanelVisible = ref(false)
const activeTopCategoryId = ref('')

const flashSessions = ref<SessionVO[]>([])
const flashLoading = ref(false)
const flashError = ref('')
const flashPageNum = ref(1)
const flashPageSize = 10
const activeFlashSessionId = ref('')

const hotKeywords = ['iPhone 17', '轻薄笔记本', '无线降噪耳机', '机械键盘', '家用投影仪', '咖啡机']

const fallbackCategories: CategoryVO[] = [
  { name: '手机数码' },
  { name: '电脑办公' },
  { name: '家用电器' },
  { name: '运动户外' },
  { name: '食品生鲜' },
  { name: '美妆护肤' },
]

const toErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

const normalizeCategoryTree = (list: CategoryVO[]): CategoryVO[] =>
  list.map((item) => ({
    ...item,
    children: Array.isArray(item.children) ? normalizeCategoryTree(item.children) : [],
  }))

const topCategories = computed(() =>
  categoryTree.value.length ? categoryTree.value : fallbackCategories,
)
const activeTopCategory = computed(
  () =>
    topCategories.value.find((item) => String(item.catId ?? '') === activeTopCategoryId.value) ||
    topCategories.value[0],
)
const activeFlashSession = computed(
  () =>
    flashSessions.value.find((item) => String(item.id ?? '') === activeFlashSessionId.value) ||
    flashSessions.value[0],
)
const activeFlashProducts = computed(() => activeFlashSession.value?.skuInfos || [])

const formatPrice = (price?: number) => `¥${Number(price || 0).toFixed(2)}`
const formatSessionTime = (value?: string) => {
  const t = value ? new Date(value).getTime() : Number.NaN
  if (Number.isNaN(t)) return '--:--'
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const formatSessionRange = (session: SessionVO) =>
  `${formatSessionTime(session.startTime)} - ${formatSessionTime(session.endTime)}`
const isSessionRunning = (session: SessionVO) => {
  const start = session.startTime ? new Date(session.startTime).getTime() : Number.NaN
  const end = session.endTime ? new Date(session.endTime).getTime() : Number.NaN
  if (Number.isNaN(start) || Number.isNaN(end)) return false
  const now = Date.now()
  return now >= start && now <= end
}
const sessionStatus = (session: SessionVO) => {
  const start = session.startTime ? new Date(session.startTime).getTime() : Number.NaN
  const end = session.endTime ? new Date(session.endTime).getTime() : Number.NaN
  if (Number.isNaN(start) || Number.isNaN(end)) return '未知'
  const now = Date.now()
  if (now < start) return '即将开始'
  if (now > end) return '已结束'
  return '进行中'
}

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
  if (typeof code !== 'string' || typeof state !== 'string') return false

  authLoading.value = true
  authMessage.value = '正在完成 GitHub 授权登录，请稍候...'
  try {
    await authLoginByGithubCode(code, state)
    await router.replace({ path: '/' })
    authMessage.value = 'GitHub 登录成功'
    await loadCurrentUser()
  } catch (error) {
    authMessage.value = toErrorMessage(error, 'GitHub 登录失败')
  } finally {
    authLoading.value = false
  }
  return true
}

const handleLogout = async () => {
  if (authLoading.value) return
  authLoading.value = true
  try {
    await logout()
  } catch {
    // 兼容后端未开放退出接口场景
  } finally {
    localStorage.removeItem('access_token')
    userId.value = ''
    authLoading.value = false
    authMessage.value = '已退出登录'
    await router.push('/login')
  }
}

const requestProducts = async (
  target: typeof recommendProducts,
  loadingRef: typeof recommendLoading,
  params: ProductSearchParam,
) => {
  loadingRef.value = true
  try {
    const res = await searchProducts(params)
    target.value = res.data?.products || []
  } catch (error) {
    pageError.value = toErrorMessage(error, '商品加载失败，请稍后重试')
  } finally {
    loadingRef.value = false
  }
}

const loadHomeProducts = async () => {
  pageError.value = ''
  await Promise.all([
    requestProducts(recommendProducts, recommendLoading, { pageNum: 0, pageSize: 12 }),
    requestProducts(hotProducts, hotLoading, { pageNum: 0, pageSize: 12, sort: ['saleCount_desc'] }),
    requestProducts(guessProducts, guessLoading, { pageNum: 0, pageSize: 12, sort: ['hotScore_desc'] }),
  ])
}

const loadCategoryData = async () => {
  categoryLoading.value = true
  categoryError.value = ''
  try {
    const res = await getCategoryTree()
    const list = Array.isArray(res.data) ? normalizeCategoryTree(res.data) : []
    categoryTree.value = list
    activeTopCategoryId.value = String(list[0]?.catId ?? '')
  } catch (error) {
    categoryTree.value = []
    activeTopCategoryId.value = ''
    categoryError.value = toErrorMessage(error, '分类加载失败，已展示默认分类')
  } finally {
    categoryLoading.value = false
  }
}

const loadFlashSessions = async (page: number) => {
  flashLoading.value = true
  flashError.value = ''
  try {
    const res = await getFlashSaleSessions({
      withExpired: false,
      withProducts: true,
      pageNum: page,
      pageSize: flashPageSize,
    })
    const list = Array.isArray(res.data) ? res.data : []
    if (page > 1 && list.length === 0) {
      flashError.value = '已到最后一页'
      return
    }
    flashSessions.value = list
    flashPageNum.value = page
    if (list.length) {
      const running = list.find(isSessionRunning)
      const fallback = list[0]
      activeFlashSessionId.value = String((running || fallback)?.id ?? '')
    } else {
      activeFlashSessionId.value = ''
    }
  } catch (error) {
    flashError.value = toErrorMessage(error, '秒杀场次加载失败，请稍后重试')
  } finally {
    flashLoading.value = false
  }
}

const goSearch = (keyword?: string) => {
  if (authLoading.value) return
  const value = (keyword ?? searchKeyword.value).trim()
  void router.push({ name: 'search', query: value ? { keyword: value } : {} })
}

const goCategorySearch = (category: CategoryVO) => {
  if (authLoading.value) return
  if (category.catId !== undefined && category.catId !== null) {
    void router.push({ name: 'search', query: { catalogId: String(category.catId) } })
    return
  }
  goSearch(category.name || '')
}

const goProductDetail = (skuId?: string) => {
  if (authLoading.value || !skuId) return
  void router.push({ name: 'productDetail', params: { skuId } })
}

const selectFlashSession = (session: SessionVO) => {
  if (authLoading.value) return
  activeFlashSessionId.value = String(session.id ?? '')
}

const openCategoryPanel = (category: CategoryVO) => {
  categoryPanelVisible.value = true
  activeTopCategoryId.value = String(category.catId ?? '')
}

onMounted(async () => {
  const handled = await handleGithubCallback()
  if (!handled) await loadCurrentUser()
  await Promise.all([loadHomeProducts(), loadCategoryData(), loadFlashSessions(1)])
})
</script>

<template>
  <main class="mall-home">
    <div v-if="authLoading" class="auth-overlay">
      <div class="overlay-card">
        <div class="overlay-shimmer"></div>
        <div class="spinner"></div>
        <h3>登录处理中</h3>
        <p>正在完成 GitHub OAuth 授权，请稍候...</p>
      </div>
    </div>

    <header class="top-bar">
      <div class="container top-inner">
        <div class="links links-muted">
          <span>品牌馆</span>
          <span>企业采购</span>
          <span>客户服务</span>
        </div>
        <div class="links">
          <template v-if="userId">
            <span class="welcome">欢迎回来，用户 {{ userId }}</span>
            <button class="link-btn" :disabled="authLoading" @click="handleLogout">退出</button>
          </template>
          <template v-else>
            <router-link to="/login">登录</router-link>
            <router-link to="/register">注册</router-link>
          </template>
          <router-link to="/cart">购物车</router-link>
          <router-link to="/order/list">我的订单</router-link>
        </div>
      </div>
    </header>

    <section class="container search-wrap">
      <div class="brand">
        <strong>Smart Mall</strong>
        <small>品质甄选</small>
      </div>
      <div class="search-main">
        <div class="search-box">
          <input
            v-model="searchKeyword"
            :disabled="authLoading"
            placeholder="搜索商品、品牌、分类"
            @keyup.enter="goSearch()"
          />
          <button :disabled="authLoading" @click="goSearch()">搜索</button>
        </div>
        <div class="hot-words">
          <a v-for="word in hotKeywords" :key="word" href="javascript:void(0)" @click="goSearch(word)">
            {{ word }}
          </a>
        </div>
      </div>
    </section>

    <section class="container hero">
      <aside class="menu" @mouseleave="categoryPanelVisible = false">
        <h3>全部分类</h3>
        <div v-if="categoryLoading" class="tip">分类加载中...</div>
        <div v-else-if="categoryError" class="tip">{{ categoryError }}</div>
        <ul>
          <li
            v-for="category in topCategories"
            :key="String(category.catId ?? category.name)"
            @mouseenter="openCategoryPanel(category)"
            @click="goCategorySearch(category)"
          >
            <span>{{ category.name }}</span>
            <span>›</span>
          </li>
        </ul>
        <div v-if="categoryPanelVisible && activeTopCategory?.children?.length" class="popup">
          <div
            v-for="second in activeTopCategory.children"
            :key="String(second.catId ?? second.name)"
            class="group"
          >
            <h4 @click.stop="goCategorySearch(second)">{{ second.name }}</h4>
            <button
              v-for="third in second.children"
              :key="String(third.catId ?? third.name)"
              :disabled="authLoading"
              @click.stop="goCategorySearch(third)"
            >
              {{ third.name }}
            </button>
          </div>
        </div>
      </aside>
      <div class="banner">
        <div class="banner-content">
          <p class="banner-kicker">SPRING SUPER SALE</p>
          <h2>春季限时狂欢</h2>
          <p>尖货每满 300 减 40，爆款直降，整点限量秒杀</p>
          <button :disabled="authLoading" @click="goSearch()">立即选购</button>
        </div>
        <div class="banner-glow"></div>
      </div>
    </section>

    <section class="container" v-if="authMessage"><div class="msg">{{ authMessage }}</div></section>
    <section class="container" v-if="pageError"><div class="msg">{{ pageError }}</div></section>

    <section class="container card flash-card">
      <header>
        <h3>秒杀专区</h3>
        <div class="pager">
          <button
            :disabled="authLoading || flashLoading || flashPageNum <= 1"
            @click="loadFlashSessions(flashPageNum - 1)"
          >
            上一页
          </button>
          <span>第 {{ flashPageNum }} 页</span>
          <button :disabled="authLoading || flashLoading" @click="loadFlashSessions(flashPageNum + 1)">
            下一页
          </button>
        </div>
      </header>
      <div v-if="flashLoading" class="empty">秒杀场次加载中...</div>
      <template v-else-if="flashSessions.length">
        <div class="tabs">
          <button
            v-for="session in flashSessions"
            :key="String(session.id)"
            :disabled="authLoading"
            :class="{ active: String(session.id) === String(activeFlashSession?.id) }"
            @click="selectFlashSession(session)"
          >
            <strong>{{ session.name || '秒杀场次' }}</strong>
            <small>{{ formatSessionRange(session) }}</small>
            <span class="status">{{ sessionStatus(session) }}</span>
          </button>
        </div>
        <div class="grid">
          <article
            v-for="item in activeFlashProducts"
            :key="String(item.id ?? item.skuId)"
            @click="goProductDetail(item.skuId)"
          >
            <img :src="item.skuDefaultImg || '/favicon.ico'" :alt="item.skuTitle || item.skuName" />
            <h4>{{ item.skuTitle || item.skuName || '秒杀商品' }}</h4>
            <p class="price">{{ formatPrice(item.seckillPrice) }}</p>
            <p class="sub">限购 {{ item.seckillLimit || 0 }} 件</p>
          </article>
        </div>
      </template>
      <div v-else class="empty">暂无秒杀场次</div>
      <div v-if="flashError" class="msg">{{ flashError }}</div>
    </section>

    <section class="container card">
      <header><h3>推荐商品</h3></header>
      <div class="grid" v-if="!recommendLoading && recommendProducts.length">
        <article v-for="item in recommendProducts" :key="item.skuId" @click="goProductDetail(item.skuId)">
          <img :src="item.skuImg || '/favicon.ico'" :alt="item.skuTitle" />
          <h4>{{ item.skuTitle }}</h4>
          <p class="price">{{ formatPrice(item.skuPrice) }}</p>
        </article>
      </div>
      <div class="empty" v-else>加载中或暂无数据</div>
    </section>

    <section class="container card">
      <header><h3>热卖商品</h3></header>
      <div class="grid" v-if="!hotLoading && hotProducts.length">
        <article v-for="item in hotProducts" :key="item.skuId" @click="goProductDetail(item.skuId)">
          <img :src="item.skuImg || '/favicon.ico'" :alt="item.skuTitle" />
          <h4>{{ item.skuTitle }}</h4>
          <p class="price">{{ formatPrice(item.skuPrice) }}</p>
        </article>
      </div>
      <div class="empty" v-else>加载中或暂无数据</div>
    </section>

    <section class="container card">
      <header><h3>猜你喜欢</h3></header>
      <div class="grid" v-if="!guessLoading && guessProducts.length">
        <article v-for="item in guessProducts" :key="item.skuId" @click="goProductDetail(item.skuId)">
          <img :src="item.skuImg || '/favicon.ico'" :alt="item.skuTitle" />
          <h4>{{ item.skuTitle }}</h4>
          <p class="price">{{ formatPrice(item.skuPrice) }}</p>
        </article>
      </div>
      <div class="empty" v-else>加载中或暂无数据</div>
    </section>
  </main>
</template>

<style scoped>
.mall-home {
  --brand-1: #8f1322;
  --brand-2: #c1202f;
  --brand-3: #f4b670;
  --ink-1: #1e2128;
  --ink-2: #525863;
  --line: #eceff6;
  --surface: #ffffff;
  --surface-2: #fafbfd;
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% -8%, rgba(255, 232, 197, 0.6) 0, rgba(255, 232, 197, 0) 32%),
    radial-gradient(circle at 92% 2%, rgba(200, 31, 47, 0.16) 0, rgba(200, 31, 47, 0) 30%),
    #f3f5fa;
  color: var(--ink-1);
}

.container {
  width: 1220px;
  max-width: calc(100% - 24px);
  margin: 0 auto;
}

.auth-overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(14, 16, 22, 0.52);
  backdrop-filter: blur(3px);
  z-index: 110;
}

.overlay-card {
  position: relative;
  width: min(440px, calc(100% - 28px));
  border-radius: 16px;
  padding: 32px 22px 26px;
  text-align: center;
  overflow: hidden;
  color: #fff;
  background: linear-gradient(140deg, #7f0f1c 0, #c1202f 60%, #d74d38 100%);
  box-shadow: 0 26px 60px rgba(13, 14, 20, 0.4);
}

.overlay-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0));
  transform: translateX(-120%);
  animation: sweep 1.9s ease-in-out infinite;
}

.spinner {
  width: 42px;
  height: 42px;
  margin: 0 auto 12px;
  border: 4px solid rgba(255, 255, 255, 0.24);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.85s linear infinite;
}

.overlay-card h3 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
}

.overlay-card p {
  margin: 10px 0 0;
  opacity: 0.92;
}

.top-bar {
  background: rgba(255, 255, 255, 0.82);
  border-bottom: 1px solid rgba(205, 36, 53, 0.12);
  backdrop-filter: blur(8px);
  font-size: 12px;
}

.top-inner {
  min-height: 38px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.links {
  display: flex;
  gap: 12px;
  align-items: center;
  color: #6c7380;
}

.links a {
  color: #6c7380;
  text-decoration: none;
}

.links a:hover {
  color: var(--brand-2);
}

.links-muted span + span::before {
  content: '/';
  margin-right: 12px;
  color: #c7ccd7;
}

.welcome {
  color: var(--ink-1);
}

.link-btn {
  border: none;
  background: transparent;
  color: var(--brand-2);
  cursor: pointer;
}

.search-wrap {
  margin-top: 14px;
  border: 1px solid rgba(193, 32, 47, 0.12);
  background: rgba(255, 255, 255, 0.9);
  border-radius: 14px;
  padding: 16px;
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 16px;
  box-shadow: 0 12px 40px rgba(14, 20, 35, 0.06);
}

.brand {
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(125deg, #8b1221, #c1202f, #de5f3b);
  display: grid;
  place-items: center;
  padding: 12px;
}

.brand strong {
  font-size: 30px;
  letter-spacing: 0.5px;
  font-weight: 800;
}

.brand small {
  opacity: 0.86;
}

.search-main {
  min-width: 0;
}

.search-box {
  display: flex;
}

.search-box input {
  flex: 1;
  min-width: 200px;
  height: 44px;
  border: 2px solid #b51f2d;
  border-right: none;
  border-radius: 10px 0 0 10px;
  padding: 0 12px;
  background: #fff;
  transition: box-shadow 0.2s ease;
}

.search-box input:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 1px rgba(181, 31, 45, 0.25);
}

.search-box button {
  height: 44px;
  border: none;
  border-radius: 0 10px 10px 0;
  color: #fff;
  padding: 0 24px;
  font-size: 15px;
  font-weight: 600;
  background: linear-gradient(130deg, #971625, #c1202f);
  cursor: pointer;
}

.search-box button:hover {
  filter: brightness(1.03);
}

.hot-words {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.hot-words a {
  color: #7b8290;
  text-decoration: none;
  font-size: 12px;
  border-radius: 99px;
  padding: 4px 10px;
  background: #f4f6fb;
  transition: all 0.2s ease;
}

.hot-words a:hover {
  color: #a21829;
  background: #ffe9ea;
}

.hero {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 264px 1fr;
  gap: 12px;
  align-items: start;
}

.menu,
.banner,
.card {
  background: var(--surface);
  border-radius: 14px;
}

.menu {
  position: relative;
  padding: 14px;
  border: 1px solid var(--line);
  max-height: 540px;
  display: flex;
  flex-direction: column;
}

.menu h3 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 700;
}

.menu ul {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  min-height: 0;
  padding-right: 4px;
}

.menu ul::-webkit-scrollbar,
.popup::-webkit-scrollbar {
  width: 8px;
}

.menu ul::-webkit-scrollbar-thumb,
.popup::-webkit-scrollbar-thumb {
  background: #d8dde7;
  border-radius: 999px;
}

.menu ul::-webkit-scrollbar-track,
.popup::-webkit-scrollbar-track {
  background: transparent;
}

.menu li {
  height: 37px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 0 10px;
  border-radius: 8px;
  transition: all 0.2s ease;
  color: var(--ink-2);
}

.menu li:hover {
  background: #fff0ef;
  color: var(--brand-2);
  transform: translateX(2px);
}

.tip {
  font-size: 12px;
  color: #8a92a0;
  margin-bottom: 8px;
}

.popup {
  position: absolute;
  left: calc(100% + 10px);
  top: 0;
  width: 450px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 20px 44px rgba(17, 22, 38, 0.18);
  padding: 14px;
  z-index: 20;
  animation: rise 0.18s ease;
  max-height: 540px;
  overflow-y: auto;
}

.group + .group {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #ebeef3;
}

.group h4 {
  margin: 0 0 8px;
  color: var(--brand-2);
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
}

.group h4:hover {
  color: #841421;
}

.group button {
  margin: 0 8px 8px 0;
  height: 30px;
  border: 1px solid #eceff4;
  border-radius: 999px;
  background: #fff;
  color: #5e6674;
  padding: 0 12px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.group button:hover {
  border-color: #f1b3b8;
  color: #a91829;
  background: #fff4f4;
}

.banner {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(193, 32, 47, 0.08);
  background:
    radial-gradient(circle at 80% 12%, rgba(255, 209, 150, 0.7) 0, rgba(255, 209, 150, 0) 22%),
    linear-gradient(130deg, #7f0f1c, #b11d2d 52%, #db4c35);
  color: #fff;
  min-height: 540px;
}

.banner-content {
  position: relative;
  z-index: 1;
  padding: 30px;
  max-width: 460px;
}

.banner-kicker {
  margin: 0;
  font-size: 11px;
  letter-spacing: 1.7px;
  opacity: 0.86;
}

.banner h2 {
  margin: 8px 0 6px;
  font-size: 36px;
  font-weight: 800;
  line-height: 1.2;
}

.banner p {
  margin: 0;
  opacity: 0.92;
}

.banner button {
  margin-top: 18px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  height: 38px;
  padding: 0 16px;
  cursor: pointer;
}

.banner button:hover {
  background: rgba(255, 255, 255, 0.24);
}

.banner-glow {
  position: absolute;
  width: 260px;
  aspect-ratio: 1 / 1;
  right: -60px;
  bottom: -90px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.44), rgba(255, 255, 255, 0));
}

.msg {
  margin-top: 10px;
  border-radius: 10px;
  border: 1px solid #ffd2d6;
  background: #fff4f5;
  padding: 10px 12px;
  color: #b02635;
  font-size: 13px;
}

.card {
  margin-top: 14px;
  border: 1px solid var(--line);
  padding: 14px;
  box-shadow: 0 10px 30px rgba(14, 18, 30, 0.04);
}

.card header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.card h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.pager {
  display: flex;
  gap: 10px;
  align-items: center;
}

.card header button {
  height: 32px;
  border: 1px solid #f2d3d1;
  border-radius: 8px;
  background: #fff;
  color: #9f3443;
  padding: 0 12px;
  cursor: pointer;
}

.card header button:hover:not(:disabled) {
  border-color: #df9ea2;
  background: #fff8f8;
}

.card button:disabled {
  opacity: 0.52;
  cursor: not-allowed;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.tabs button {
  border: 1px solid #ebeef4;
  border-radius: 10px;
  background: #fbfcfe;
  padding: 10px;
  text-align: left;
  cursor: pointer;
  display: grid;
  gap: 4px;
  transition: all 0.2s ease;
}

.tabs button.active {
  border-color: #d8828a;
  background: linear-gradient(145deg, #fff5f6, #fff);
}

.tabs strong {
  font-size: 14px;
}

.tabs small {
  color: #7f8794;
}

.status {
  justify-self: start;
  font-size: 12px;
  color: #2d7e53;
  background: #e7f8ef;
  border-radius: 999px;
  padding: 2px 8px;
}

.grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 12px;
}

.grid article {
  border: 1px solid #eceff5;
  border-radius: 12px;
  padding: 10px;
  cursor: pointer;
  background: #fff;
  transition: all 0.2s ease;
}

.grid article:hover {
  border-color: #eab2b7;
  box-shadow: 0 14px 28px rgba(21, 24, 33, 0.1);
  transform: translateY(-2px);
}

.grid img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 9px;
  background: #f2f5f9;
}

.grid h4 {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.4;
  min-height: 38px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.price {
  color: #b31628;
  font-size: 22px;
  font-weight: 700;
  margin: 8px 0 0;
}

.sub {
  margin: 6px 0 0;
  font-size: 12px;
  color: #8f97a5;
}

.empty {
  min-height: 120px;
  display: grid;
  place-items: center;
  color: #8e95a2;
}

@media (max-width: 1140px) {
  .search-wrap {
    grid-template-columns: 1fr;
  }

  .brand {
    min-height: 90px;
  }

  .hero {
    grid-template-columns: 1fr;
  }

  .popup {
    position: static;
    width: auto;
    margin-top: 10px;
  }

  .tabs {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .banner h2 {
    font-size: 30px;
  }

  .tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 540px) {
  .search-box {
    flex-direction: column;
    gap: 8px;
  }

  .search-box input {
    border-right: 2px solid #b51f2d;
    border-radius: 10px;
  }

  .search-box button {
    border-radius: 10px;
  }

  .grid,
  .tabs {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes sweep {
  to {
    transform: translateX(120%);
  }
}
</style>
