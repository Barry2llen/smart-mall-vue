<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getSkuItem,
  type SkuItemSaleAttrVO,
  type SkuItemVO,
  type SpuItemAttrGroupVO,
} from '@/api/product'
import {
  getFlashSaleSessionById,
  getFlashSaleSessionsBySkuId,
  isSkuInFlashSale,
  type FlashSaleSession,
  type SessionRelatedSkuInfoVO,
  type SessionVO,
} from '@/api/flashSale'

defineOptions({ name: 'ProductDetailPage' })

interface SaleAttrDisplay {
  attrId: string
  attrName: string
  values: string[]
}

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const errorMessage = ref('')
const productItem = ref<SkuItemVO | null>(null)
const activeImageUrl = ref('')

const inFlashSale = ref(false)
const flashLoading = ref(false)
const flashDetailLoading = ref(false)
const flashError = ref('')
const flashSessions = ref<FlashSaleSession[]>([])
const activeSessionId = ref('')
const activeSessionDetail = ref<SessionVO | null>(null)

let loadSerial = 0
let flashDetailSerial = 0

const skuId = computed(() => {
  const value = route.params.skuId
  if (Array.isArray(value)) {
    return value[0] || ''
  }
  return typeof value === 'string' ? value : ''
})

const skuInfo = computed(() => productItem.value?.skuInfo)

const galleryImages = computed(() => {
  const sources = [...(productItem.value?.images || [])]
    .sort((a, b) => Number(a.imgSort ?? 0) - Number(b.imgSort ?? 0))
    .map((item) => item.imgUrl || '')
    .filter(Boolean)

  const defaultImg = skuInfo.value?.skuDefaultImg || ''
  if (defaultImg) {
    sources.unshift(defaultImg)
  }

  return Array.from(new Set(sources))
})

const currentImage = computed(() => {
  if (activeImageUrl.value && galleryImages.value.includes(activeImageUrl.value)) {
    return activeImageUrl.value
  }
  return galleryImages.value[0] || ''
})

const saleAttrs = computed<SaleAttrDisplay[]>(() => {
  const attrs = Array.isArray(productItem.value?.saleAttr) ? productItem.value?.saleAttr : []
  return attrs
    .map((item: SkuItemSaleAttrVO) => {
      const values = String(item.attrValues || '')
        .split(/[，,;；|、/]/)
        .map((value) => value.trim())
        .filter(Boolean)
      return {
        attrId: String(item.attrId || ''),
        attrName: item.attrName || '销售属性',
        values,
      }
    })
    .filter((item) => item.values.length)
})

const specGroups = computed<SpuItemAttrGroupVO[]>(() => {
  return Array.isArray(productItem.value?.groupAttrs) ? productItem.value?.groupAttrs || [] : []
})

const descImages = computed(() => {
  const raw = String(productItem.value?.desp?.decript || '').trim()
  if (!raw) {
    return []
  }

  const urlMatches = raw.match(/https?:\/\/[^\s,，;；]+/g)
  if (Array.isArray(urlMatches) && urlMatches.length) {
    return Array.from(new Set(urlMatches))
  }

  const parts = raw
    .split(/[\n,，;；]/)
    .map((item) => item.trim())
    .filter((item) => item.startsWith('http://') || item.startsWith('https://') || item.startsWith('/'))

  return Array.from(new Set(parts))
})

const activeSession = computed(() => {
  return flashSessions.value.find((session) => String(session.id || '') === activeSessionId.value)
})

const activeFlashSku = computed<SessionRelatedSkuInfoVO | undefined>(() => {
  const list = activeSessionDetail.value?.skuInfos || []
  return list.find((item) => String(item.skuId || '') === skuId.value)
})

const flashDiscount = computed(() => {
  const origin = Number(skuInfo.value?.price || 0)
  const flashPrice = Number(activeFlashSku.value?.seckillPrice || 0)
  const discount = origin - flashPrice
  return discount > 0 ? discount : 0
})

const hasFlashData = computed(() => Boolean(activeFlashSku.value && activeSession.value))

const formatPrice = (value?: number) => `¥${Number(value || 0).toFixed(2)}`

const formatDateTime = (value?: string) => {
  const timestamp = value ? new Date(value).getTime() : Number.NaN
  if (Number.isNaN(timestamp)) {
    return '--'
  }
  const date = new Date(timestamp)
  const datePart = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
  const timePart = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${datePart} ${timePart}`
}

const getSessionStatus = (session?: FlashSaleSession | SessionVO) => {
  if (!session) return '未知'
  const start = session.startTime ? new Date(session.startTime).getTime() : Number.NaN
  const end = session.endTime ? new Date(session.endTime).getTime() : Number.NaN
  if (Number.isNaN(start) || Number.isNaN(end)) return '未知'

  const now = Date.now()
  if (now < start) return '即将开始'
  if (now > end) return '已结束'
  return '进行中'
}

const chooseBestSession = (sessions: FlashSaleSession[]) => {
  if (!sessions.length) {
    return undefined
  }

  const now = Date.now()
  const running = sessions.find((session) => {
    const start = session.startTime ? new Date(session.startTime).getTime() : Number.NaN
    const end = session.endTime ? new Date(session.endTime).getTime() : Number.NaN
    return !Number.isNaN(start) && !Number.isNaN(end) && now >= start && now <= end
  })
  if (running) {
    return running
  }

  const upcoming = sessions
    .filter((session) => {
      const start = session.startTime ? new Date(session.startTime).getTime() : Number.NaN
      return !Number.isNaN(start) && start > now
    })
    .sort(
      (a, b) =>
        new Date(a.startTime || '').getTime() - new Date(b.startTime || '').getTime(),
    )

  if (upcoming.length) {
    return upcoming[0]
  }

  const ended = sessions
    .filter((session) => {
      const end = session.endTime ? new Date(session.endTime).getTime() : Number.NaN
      return !Number.isNaN(end) && end <= now
    })
    .sort((a, b) => new Date(b.endTime || '').getTime() - new Date(a.endTime || '').getTime())

  return ended[0] || sessions[0]
}

const toErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

const resetFlashState = () => {
  inFlashSale.value = false
  flashLoading.value = false
  flashDetailLoading.value = false
  flashError.value = ''
  flashSessions.value = []
  activeSessionId.value = ''
  activeSessionDetail.value = null
}

const fetchSessionDetail = async (sessionId: string, serialGuard?: number, fromSwitcher = false) => {
  const currentDetailSerial = ++flashDetailSerial
  if (fromSwitcher) {
    flashDetailLoading.value = true
  }

  try {
    const response = await getFlashSaleSessionById(sessionId, true)
    if (
      (typeof serialGuard === 'number' && serialGuard !== loadSerial) ||
      currentDetailSerial !== flashDetailSerial
    ) {
      return
    }
    activeSessionDetail.value = response.data || null
    flashError.value = ''
  } catch (error) {
    if (
      (typeof serialGuard === 'number' && serialGuard !== loadSerial) ||
      currentDetailSerial !== flashDetailSerial
    ) {
      return
    }
    activeSessionDetail.value = null
    flashError.value = toErrorMessage(error, '秒杀场次详情加载失败')
  } finally {
    const stale =
      (typeof serialGuard === 'number' && serialGuard !== loadSerial) ||
      currentDetailSerial !== flashDetailSerial
    if (!stale) {
      flashDetailLoading.value = false
    }
  }
}

const loadFlashData = async (currentSkuId: string, serialGuard: number) => {
  flashLoading.value = true
  flashError.value = ''
  flashSessions.value = []
  activeSessionId.value = ''
  activeSessionDetail.value = null

  try {
    const response = await getFlashSaleSessionsBySkuId(currentSkuId)
    if (serialGuard !== loadSerial) {
      return
    }

    const sessions = Array.isArray(response.data) ? response.data : []
    flashSessions.value = sessions

    const targetSession = chooseBestSession(sessions)
    if (!targetSession?.id) {
      return
    }

    activeSessionId.value = String(targetSession.id)
    await fetchSessionDetail(String(targetSession.id), serialGuard)
  } catch (error) {
    if (serialGuard !== loadSerial) {
      return
    }
    flashError.value = toErrorMessage(error, '秒杀信息加载失败，请稍后重试')
  } finally {
    if (serialGuard === loadSerial) {
      flashLoading.value = false
    }
  }
}

const loadProductDetail = async () => {
  const currentSkuId = skuId.value
  const serial = ++loadSerial

  errorMessage.value = ''
  productItem.value = null
  activeImageUrl.value = ''
  resetFlashState()

  if (!currentSkuId) {
    errorMessage.value = '商品编号缺失'
    return
  }

  loading.value = true
  try {
    const [productRes, flashRes] = await Promise.all([
      getSkuItem(currentSkuId),
      isSkuInFlashSale(currentSkuId),
    ])

    if (serial !== loadSerial) {
      return
    }

    productItem.value = productRes.data || null
    if (!productItem.value?.skuInfo) {
      errorMessage.value = '未找到商品详情'
      return
    }

    inFlashSale.value = Boolean(flashRes.data)
    if (inFlashSale.value) {
      await loadFlashData(currentSkuId, serial)
    }
  } catch (error) {
    if (serial !== loadSerial) {
      return
    }
    errorMessage.value = toErrorMessage(error, '商品详情加载失败，请稍后重试')
  } finally {
    if (serial === loadSerial) {
      loading.value = false
    }
  }
}

const chooseImage = (url: string) => {
  activeImageUrl.value = url
}

const selectFlashSession = (session: FlashSaleSession) => {
  const targetId = String(session.id || '')
  if (!targetId || targetId === activeSessionId.value) {
    return
  }
  activeSessionId.value = targetId
  void fetchSessionDetail(targetId, undefined, true)
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
    return
  }
  void router.push({ name: 'home' })
}

watch(
  galleryImages,
  (list) => {
    if (!list.length) {
      activeImageUrl.value = ''
      return
    }
    if (!activeImageUrl.value || !list.includes(activeImageUrl.value)) {
      activeImageUrl.value = list[0] || ''
    }
  },
  { immediate: true },
)

watch(
  () => route.params.skuId,
  () => {
    void loadProductDetail()
  },
  { immediate: true },
)
</script>

<template>
  <main class="product-detail-page">
    <header class="top-nav">
      <div class="container nav-inner">
        <button class="ghost-btn" type="button" @click="goBack">返回</button>
        <router-link class="brand" to="/">Smart Mall</router-link>
      </div>
    </header>

    <section class="container state-wrap" v-if="loading">
      <div class="state-card">商品详情加载中...</div>
    </section>

    <section class="container state-wrap" v-else-if="errorMessage">
      <div class="state-card error">{{ errorMessage }}</div>
    </section>

    <template v-else-if="skuInfo">
      <section class="container hero-card">
        <div class="gallery-panel">
          <div class="preview-wrap">
            <img v-if="currentImage" :src="currentImage" :alt="skuInfo.skuTitle || skuInfo.skuName" />
            <div v-else class="preview-empty">暂无商品图片</div>
          </div>
          <div class="thumb-list" v-if="galleryImages.length">
            <button
              v-for="img in galleryImages"
              :key="img"
              type="button"
              :class="{ active: img === currentImage }"
              @click="chooseImage(img)"
            >
              <img :src="img" :alt="skuInfo.skuTitle || skuInfo.skuName" />
            </button>
          </div>
        </div>

        <div class="info-panel">
          <h1>{{ skuInfo.skuTitle || skuInfo.skuName || '商品详情' }}</h1>
          <p class="subtitle" v-if="skuInfo.skuSubtitle || skuInfo.skuDesc">
            {{ skuInfo.skuSubtitle || skuInfo.skuDesc }}
          </p>

          <div class="price-box" :class="{ 'has-flash': hasFlashData }">
            <template v-if="hasFlashData">
              <div class="price-tag flash">
                <span>秒杀价</span>
                <strong>{{ formatPrice(activeFlashSku?.seckillPrice) }}</strong>
              </div>
              <div class="price-tag origin">
                <span>日常价</span>
                <del>{{ formatPrice(skuInfo.price) }}</del>
              </div>
              <div class="discount">立省 {{ formatPrice(flashDiscount) }}</div>
            </template>
            <template v-else>
              <div class="price-tag normal">
                <span>售价</span>
                <strong>{{ formatPrice(skuInfo.price) }}</strong>
              </div>
            </template>
          </div>

          <div class="meta-row">
            <span>销量 {{ Number(skuInfo.saleCount || 0) }}</span>
            <span>SKU：{{ skuInfo.skuId || '--' }}</span>
            <span>SPU：{{ skuInfo.spuId || '--' }}</span>
            <span>分类：{{ skuInfo.catalogId || '--' }}</span>
          </div>

          <div class="attr-list" v-if="saleAttrs.length">
            <div class="attr-row" v-for="attr in saleAttrs" :key="`${attr.attrId}-${attr.attrName}`">
              <label>{{ attr.attrName }}</label>
              <div class="chips">
                <span v-for="value in attr.values" :key="value" class="chip">{{ value }}</span>
              </div>
            </div>
          </div>

          <section class="flash-panel" v-if="inFlashSale">
            <header>
              <h3>秒杀活动</h3>
              <span class="status">{{ getSessionStatus(activeSession) }}</span>
            </header>

            <p class="flash-error" v-if="flashError">{{ flashError }}</p>
            <p class="flash-loading" v-else-if="flashLoading || flashDetailLoading">秒杀信息加载中...</p>
            <template v-else>
              <div class="session-tabs" v-if="flashSessions.length">
                <button
                  v-for="session in flashSessions"
                  :key="String(session.id || '')"
                  type="button"
                  :class="{ active: String(session.id || '') === activeSessionId }"
                  @click="selectFlashSession(session)"
                >
                  <strong>{{ session.name || '秒杀场次' }}</strong>
                  <small>{{ formatDateTime(session.startTime) }} ~ {{ formatDateTime(session.endTime) }}</small>
                </button>
              </div>

              <div class="flash-info" v-if="hasFlashData">
                <p>
                  限购数量：
                  <strong>{{ activeFlashSku?.seckillLimit || 0 }}</strong>
                  件
                </p>
                <p>
                  秒杀总量：
                  <strong>{{ activeFlashSku?.seckillCount || 0 }}</strong>
                  件
                </p>
                <p>
                  场次时间：{{ formatDateTime(activeSession?.startTime) }} -
                  {{ formatDateTime(activeSession?.endTime) }}
                </p>
              </div>
              <p v-else class="flash-empty">当前场次暂无该商品的秒杀明细</p>
            </template>
          </section>
        </div>
      </section>

      <section class="container card" v-if="specGroups.length">
        <header><h2>规格参数</h2></header>
        <div class="spec-group" v-for="group in specGroups" :key="group.groupName || 'group'">
          <h3>{{ group.groupName || '参数分组' }}</h3>
          <div class="spec-grid" v-if="group.attrs?.length">
            <div class="spec-item" v-for="attr in group.attrs" :key="`${attr.attrId}-${attr.attrName}`">
              <label>{{ attr.attrName || '--' }}</label>
              <span>{{ attr.attrValue || '--' }}</span>
            </div>
          </div>
          <p v-else class="empty-tip">暂无分组参数</p>
        </div>
      </section>

      <section class="container card">
        <header><h2>图文详情</h2></header>
        <div class="desc-images" v-if="descImages.length">
          <img
            v-for="img in descImages"
            :key="img"
            :src="img"
            :alt="skuInfo.skuTitle || skuInfo.skuName || '商品详情图'"
          />
        </div>
        <p class="empty-tip" v-else>{{ skuInfo.skuDesc || '暂无图文详情' }}</p>
      </section>
    </template>

    <section class="container state-wrap" v-else>
      <div class="state-card">暂无商品详情</div>
    </section>
  </main>
</template>

<style scoped>
.product-detail-page {
  --brand-1: #8f1322;
  --brand-2: #c1202f;
  --ink-1: #21252f;
  --ink-2: #596171;
  --line: #e8ecf4;
  --surface: #ffffff;
  min-height: 100vh;
  background:
    radial-gradient(circle at 8% -6%, rgba(255, 226, 189, 0.56) 0, rgba(255, 226, 189, 0) 32%),
    radial-gradient(circle at 92% 4%, rgba(193, 32, 47, 0.12) 0, rgba(193, 32, 47, 0) 28%),
    #f3f5fa;
  color: var(--ink-1);
  padding-bottom: 28px;
}

.container {
  width: 1220px;
  max-width: calc(100% - 24px);
  margin: 0 auto;
}

.top-nav {
  border-bottom: 1px solid rgba(193, 32, 47, 0.12);
  background: rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(8px);
}

.nav-inner {
  min-height: 56px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.ghost-btn {
  height: 34px;
  border: 1px solid #f0c8cb;
  border-radius: 8px;
  background: #fff;
  color: #982636;
  padding: 0 14px;
  cursor: pointer;
}

.brand {
  color: var(--brand-2);
  font-weight: 800;
  text-decoration: none;
  font-size: 20px;
}

.state-wrap {
  padding-top: 18px;
}

.state-card {
  min-height: 180px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  display: grid;
  place-items: center;
  color: var(--ink-2);
}

.state-card.error {
  color: #b12637;
  border-color: #ffd2d6;
  background: #fff4f5;
}

.hero-card {
  margin-top: 18px;
  display: grid;
  grid-template-columns: 520px 1fr;
  gap: 20px;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 18px;
  background: var(--surface);
  box-shadow: 0 14px 36px rgba(18, 22, 31, 0.06);
}

.preview-wrap {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  border: 1px solid #e7ebf3;
  background: #f8fafd;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.preview-wrap img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preview-empty {
  color: #8f97a5;
}

.thumb-list {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}

.thumb-list button {
  border: 1px solid #e8ecf4;
  border-radius: 8px;
  padding: 2px;
  background: #fff;
  cursor: pointer;
}

.thumb-list button.active {
  border-color: #dd8f97;
  box-shadow: inset 0 0 0 1px rgba(193, 32, 47, 0.15);
}

.thumb-list img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 6px;
}

.info-panel h1 {
  margin: 0;
  font-size: 29px;
  line-height: 1.35;
}

.subtitle {
  margin: 10px 0 0;
  color: var(--ink-2);
  line-height: 1.6;
}

.price-box {
  margin-top: 16px;
  border: 1px solid #eceff6;
  border-radius: 12px;
  padding: 14px;
  background: #fafbfd;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.price-box.has-flash {
  border-color: #f2c5c8;
  background: linear-gradient(130deg, #fff7f7, #fff);
}

.price-tag {
  display: grid;
  gap: 4px;
}

.price-tag span {
  color: #78808d;
  font-size: 13px;
}

.price-tag strong {
  color: #b51f2d;
  font-size: 30px;
  line-height: 1;
}

.price-tag del {
  color: #98a0ad;
  font-size: 20px;
}

.discount {
  margin-left: auto;
  color: #2f7d53;
  background: #e8f8ef;
  border-radius: 999px;
  padding: 6px 12px;
  font-weight: 700;
}

.meta-row {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.meta-row span {
  border-radius: 999px;
  background: #f3f6fb;
  color: #5b6270;
  padding: 5px 10px;
  font-size: 12px;
}

.attr-list {
  margin-top: 14px;
  display: grid;
  gap: 10px;
}

.attr-row {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 10px;
  align-items: start;
}

.attr-row label {
  color: #697283;
  font-size: 13px;
  padding-top: 4px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  border: 1px solid #e8ecf4;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 13px;
  color: #4f5664;
  background: #fff;
}

.flash-panel {
  margin-top: 16px;
  border: 1px solid #f0cfd2;
  border-radius: 12px;
  background: #fff8f8;
  padding: 12px;
}

.flash-panel header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.flash-panel h3 {
  margin: 0;
  font-size: 17px;
}

.flash-panel .status {
  font-size: 12px;
  color: #2f7d53;
  background: #e7f7ee;
  border-radius: 999px;
  padding: 4px 10px;
}

.flash-error {
  margin: 8px 0 0;
  color: #b22b3b;
}

.flash-loading,
.flash-empty {
  margin: 8px 0 0;
  color: #667080;
}

.session-tabs {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.session-tabs button {
  border: 1px solid #f1d9db;
  border-radius: 10px;
  background: #fff;
  text-align: left;
  padding: 8px;
  cursor: pointer;
  display: grid;
  gap: 2px;
}

.session-tabs button.active {
  border-color: #da8d95;
  background: #fff4f5;
}

.session-tabs strong {
  font-size: 13px;
}

.session-tabs small {
  font-size: 12px;
  color: #7c8492;
}

.flash-info {
  margin-top: 10px;
  display: grid;
  gap: 4px;
}

.flash-info p {
  margin: 0;
  color: #525a67;
}

.flash-info strong {
  color: #b51f2d;
}

.card {
  margin-top: 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 16px;
  background: var(--surface);
}

.card h2 {
  margin: 0;
  font-size: 22px;
}

.spec-group + .spec-group {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed #e6ebf4;
}

.spec-group h3 {
  margin: 0 0 10px;
  font-size: 16px;
}

.spec-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.spec-item {
  border: 1px solid #edf0f6;
  border-radius: 10px;
  padding: 10px;
  background: #fcfdff;
  display: grid;
  gap: 4px;
}

.spec-item label {
  color: #778091;
  font-size: 13px;
}

.desc-images {
  margin-top: 12px;
  display: grid;
  gap: 10px;
}

.desc-images img {
  width: 100%;
  border-radius: 10px;
  border: 1px solid #edf0f6;
  background: #f7f9fc;
}

.empty-tip {
  margin: 10px 0 0;
  color: #7f8795;
}

@media (max-width: 1140px) {
  .hero-card {
    grid-template-columns: 1fr;
  }

  .thumb-list {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .info-panel h1 {
    font-size: 24px;
  }

  .price-tag strong {
    font-size: 26px;
  }

  .discount {
    margin-left: 0;
  }

  .attr-row {
    grid-template-columns: 1fr;
  }

  .session-tabs {
    grid-template-columns: 1fr;
  }

  .spec-grid {
    grid-template-columns: 1fr;
  }

  .thumb-list {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
