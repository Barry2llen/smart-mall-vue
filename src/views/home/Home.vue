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

const topCategories = computed(() => (categoryTree.value.length ? categoryTree.value : fallbackCategories))
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

const goProductDetail = (skuId?: string | number) => {
  if (authLoading.value || !skuId) return
  window.location.href = `/product/${skuId}`
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
        <div class="spinner"></div>
        <h3>登录处理中</h3>
        <p>正在完成 GitHub OAuth 授权，请稍候...</p>
      </div>
    </div>

    <header class="top-bar">
      <div class="container top-inner">
        <div class="links">品牌馆 企业采购 客户服务</div>
        <div class="links">
          <template v-if="userId">
            <span>欢迎回来，用户 {{ userId }}</span>
            <button class="link-btn" :disabled="authLoading" @click="handleLogout">退出</button>
          </template>
          <template v-else>
            <router-link to="/login">登录</router-link>
            <router-link to="/register">注册</router-link>
          </template>
          <router-link to="/order/list">我的订单</router-link>
        </div>
      </div>
    </header>

    <section class="container search-wrap">
      <input v-model="searchKeyword" :disabled="authLoading" placeholder="搜索商品、品牌、分类" @keyup.enter="goSearch()" />
      <button :disabled="authLoading" @click="goSearch()">搜索</button>
      <a v-for="word in hotKeywords" :key="word" href="javascript:void(0)" @click="goSearch(word)">{{ word }}</a>
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
            <span>></span>
          </li>
        </ul>
        <div v-if="categoryPanelVisible && activeTopCategory?.children?.length" class="popup">
          <div v-for="second in activeTopCategory.children" :key="String(second.catId ?? second.name)" class="group">
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
        <h2>春季限时狂欢</h2>
        <p>尖货每满 300 减 40，爆款直降</p>
      </div>
    </section>

    <section class="container" v-if="authMessage"><div class="msg">{{ authMessage }}</div></section>
    <section class="container" v-if="pageError"><div class="msg">{{ pageError }}</div></section>

    <section class="container card">
      <header>
        <h3>秒杀专区</h3>
        <div>
          <button :disabled="authLoading || flashLoading || flashPageNum <= 1" @click="loadFlashSessions(flashPageNum - 1)">上一页</button>
          <span>第 {{ flashPageNum }} 页</span>
          <button :disabled="authLoading || flashLoading" @click="loadFlashSessions(flashPageNum + 1)">下一页</button>
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
          </button>
        </div>
        <div class="grid">
          <article v-for="item in activeFlashProducts" :key="String(item.id ?? item.skuId)" @click="goProductDetail(item.skuId)">
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
.mall-home { min-height: 100vh; background: #f5f5f5; color: #333; }
.container { width: 1200px; max-width: calc(100% - 24px); margin: 0 auto; }
.auth-overlay { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.45); z-index: 100; }
.overlay-card { background: #fff; border-radius: 12px; padding: 24px; text-align: center; width: min(420px, calc(100% - 24px)); }
.spinner { width: 36px; height: 36px; margin: 0 auto; border: 4px solid #ffe2df; border-top-color: #e1251b; border-radius: 50%; animation: spin .9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.top-bar { background: #e3e4e5; font-size: 12px; }
.top-inner { min-height: 36px; display: flex; justify-content: space-between; align-items: center; }
.links { display: flex; gap: 12px; align-items: center; }
.link-btn { border: none; background: transparent; color: #e1251b; cursor: pointer; }
.search-wrap { margin-top: 10px; background: #fff; padding: 14px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; border-radius: 10px; }
.search-wrap input { flex: 1; min-width: 220px; height: 40px; border: 2px solid #e1251b; border-radius: 6px; padding: 0 10px; }
.search-wrap button { height: 40px; border: none; border-radius: 6px; background: #e1251b; color: #fff; padding: 0 18px; cursor: pointer; }
.search-wrap a { color: #999; text-decoration: none; font-size: 12px; }
.hero { margin-top: 12px; display: grid; grid-template-columns: 250px 1fr; gap: 12px; }
.menu, .banner, .card { background: #fff; border-radius: 10px; }
.menu { padding: 12px; position: relative; }
.menu ul { list-style: none; margin: 0; padding: 0; }
.menu li { height: 34px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 0 8px; border-radius: 6px; }
.menu li:hover { background: #fff4f4; color: #e1251b; }
.tip { font-size: 12px; color: #999; margin-bottom: 8px; }
.popup { position: absolute; left: calc(100% + 6px); top: 0; width: 430px; background: #fff; border: 1px solid #eee; border-radius: 10px; box-shadow: 0 10px 26px rgba(0,0,0,.12); padding: 12px; z-index: 20; }
.group h4 { margin: 0 0 8px; color: #e1251b; cursor: pointer; }
.group button { margin: 0 8px 8px 0; height: 28px; border: 1px solid #eee; border-radius: 999px; background: #fff; padding: 0 10px; cursor: pointer; }
.banner { padding: 20px; background: linear-gradient(120deg, #d2121d, #f36a22); color: #fff; }
.msg { margin-top: 10px; padding: 8px 10px; border-radius: 6px; background: #fff1f1; color: #c53030; font-size: 13px; }
.card { margin-top: 14px; padding: 14px; }
.card header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.card header button { height: 30px; border: 1px solid #f1d4d2; border-radius: 6px; background: #fff8f7; color: #b6322a; padding: 0 10px; }
.tabs { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 10px; }
.tabs button { border: 1px solid #eee; border-radius: 8px; background: #fff; padding: 8px; text-align: left; cursor: pointer; display: grid; }
.tabs button.active { border-color: #e1251b; background: #fff4f4; }
.tabs small { color: #999; }
.grid { display: grid; gap: 12px; grid-template-columns: repeat(4, minmax(0,1fr)); margin-top: 12px; }
.grid article { border: 1px solid #eee; border-radius: 10px; padding: 10px; cursor: pointer; }
.grid article:hover { border-color: #ffd2cf; box-shadow: 0 10px 20px rgba(0,0,0,.08); transform: translateY(-2px); transition: all .2s; }
.grid img { width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 8px; background: #f6f6f6; }
.grid h4 { margin: 10px 0 0; font-size: 14px; line-height: 1.4; min-height: 38px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.price { color: #e1251b; font-size: 22px; font-weight: 700; margin: 8px 0 0; }
.sub { margin: 6px 0 0; font-size: 12px; color: #999; }
.empty { min-height: 100px; display: grid; place-items: center; color: #999; }
@media (max-width: 1100px) {
  .hero { grid-template-columns: 1fr; }
  .popup { position: static; width: auto; margin-top: 8px; }
  .tabs { grid-template-columns: repeat(3, minmax(0,1fr)); }
  .grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
}
@media (max-width: 768px) {
  .tabs { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
}
@media (max-width: 520px) {
  .grid, .tabs { grid-template-columns: 1fr; }
}
</style>
