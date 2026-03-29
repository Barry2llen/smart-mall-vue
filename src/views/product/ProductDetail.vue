<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { addCartItem } from '@/api/cart'
import {
  getSpuSkuAttrsMapping,
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

type SelectedSaleAttrMap = Record<string, string>

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const errorMessage = ref('')
const actionMessage = ref('')
const submittingCart = ref(false)
const switchingSku = ref(false)
const selectedCount = ref(1)
const productItem = ref<SkuItemVO | null>(null)
const activeImageUrl = ref('')
const skuAttrValueMapping = ref<Record<string, string>>({})
const selectedSaleAttrMap = ref<SelectedSaleAttrMap>({})

const inFlashSale = ref(false)
const flashLoading = ref(false)
const flashDetailLoading = ref(false)
const flashError = ref('')
const flashActionMessage = ref('')
const flashSessions = ref<FlashSaleSession[]>([])
const activeSessionId = ref('')
const activeSessionDetail = ref<SessionVO | null>(null)
const flashNavigating = ref(false)
const flashNow = ref(Date.now())

let loadSerial = 0
let flashDetailSerial = 0
let preservedCountOnSwitch: number | null = null
let flashTimer: number | null = null
let autoRefreshedFlashKey = ''

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

const buildSaleAttrs = (item?: SkuItemVO | null): SaleAttrDisplay[] => {
  const attrs = Array.isArray(item?.saleAttr) ? item.saleAttr : []
  return attrs
    .map((attr: SkuItemSaleAttrVO) => {
      const values = String(attr.attrValues || '')
        .split(/[，,;；|、/]/)
        .map((value) => value.trim())
        .filter(Boolean)
      return {
        attrId: String(attr.attrId || ''),
        attrName: attr.attrName || '销售属性',
        values,
      }
    })
    .filter((attr) => attr.attrId && attr.values.length)
}

const saleAttrs = computed<SaleAttrDisplay[]>(() => {
  return buildSaleAttrs(productItem.value)
})

const specGroups = computed<SpuItemAttrGroupVO[]>(() => {
  return Array.isArray(productItem.value?.groupAttrs) ? productItem.value?.groupAttrs || [] : []
})

const canSwitchSkuByAttr = computed(() => {
  return saleAttrs.value.length > 0 && Object.keys(selectedSaleAttrMap.value).length > 0
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

const activeFlashLimit = computed(() => {
  const value = Number(activeFlashSku.value?.seckillLimit || 0)
  return value > 0 ? value : Number.POSITIVE_INFINITY
})

const canIncreaseCount = computed(() => {
  if (submittingCart.value) {
    return false
  }
  if (!Number.isFinite(activeFlashLimit.value)) {
    return true
  }
  return selectedCount.value < activeFlashLimit.value
})

const flashDiscount = computed(() => {
  const origin = Number(skuInfo.value?.price || 0)
  const flashPrice = Number(activeFlashSku.value?.seckillPrice || 0)
  const discount = origin - flashPrice
  return discount > 0 ? discount : 0
})

const hasFlashData = computed(() => Boolean(activeFlashSku.value && activeSession.value))

const flashStatus = computed(() => {
  const session = activeSession.value
  if (!session) return 'unknown'
  const start = session.startTime ? new Date(session.startTime).getTime() : Number.NaN
  const end = session.endTime ? new Date(session.endTime).getTime() : Number.NaN
  if (Number.isNaN(start) || Number.isNaN(end)) return 'unknown'

  if (flashNow.value < start) return 'upcoming'
  if (flashNow.value > end) return 'ended'
  return 'running'
})

const flashCountdownText = computed(() => {
  const session = activeSession.value
  if (!session?.startTime) {
    return ''
  }
  const start = new Date(session.startTime).getTime()
  if (Number.isNaN(start)) {
    return ''
  }
  const remaining = Math.max(0, Math.ceil((start - flashNow.value) / 1000))
  const hours = String(Math.floor(remaining / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((remaining % 3600) / 60)).padStart(2, '0')
  const seconds = String(remaining % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
})

const flashActionState = computed(() => {
  if (!inFlashSale.value) return 'hidden'
  if (flashLoading.value || flashDetailLoading.value) return 'loading'
  if (flashError.value && !hasFlashData.value) return 'error'
  if (!hasFlashData.value) return 'unavailable'
  if (flashStatus.value === 'upcoming') return 'upcoming'
  if (flashStatus.value === 'ended') return 'ended'
  if (!activeFlashSku.value?.randomCode) return 'refreshing'
  if (flashNavigating.value) return 'submitting'
  return 'ready'
})

const flashActionText = computed(() => {
  switch (flashActionState.value) {
    case 'loading':
      return '秒杀信息加载中...'
    case 'upcoming':
      return flashCountdownText.value ? `距开始 ${flashCountdownText.value}` : '即将开始'
    case 'ended':
      return '活动已结束'
    case 'refreshing':
      return '正在刷新抢购资格...'
    case 'submitting':
      return '跳转中...'
    case 'error':
      return '秒杀信息加载失败'
    case 'unavailable':
      return '暂无秒杀资格'
    default:
      return '立即抢购'
  }
})

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

const syncFlashNow = () => {
  flashNow.value = Date.now()
}

const resetFlashTimer = () => {
  if (flashTimer) {
    clearInterval(flashTimer)
    flashTimer = null
  }
}

const setupFlashTimer = () => {
  resetFlashTimer()
  if (!activeSession.value || !['upcoming', 'running'].includes(flashStatus.value)) {
    return
  }
  flashTimer = window.setInterval(() => {
    syncFlashNow()
  }, 1000)
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
    .sort((a, b) => new Date(a.startTime || '').getTime() - new Date(b.startTime || '').getTime())

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

const compareAttrId = (left: string, right: string) => {
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    const leftValue = BigInt(left)
    const rightValue = BigInt(right)
    if (leftValue === rightValue) {
      return 0
    }
    return leftValue > rightValue ? 1 : -1
  }

  return left.localeCompare(right, 'zh-CN')
}

const parseMappingKey = (key: string) => {
  return key
    .split('_')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce<SelectedSaleAttrMap>((acc, segment) => {
      const separatorIndex = segment.indexOf(':')
      if (separatorIndex <= 0) {
        return acc
      }
      const attrId = segment.slice(0, separatorIndex).trim()
      const attrValue = segment.slice(separatorIndex + 1).trim()
      if (attrId && attrValue) {
        acc[attrId] = attrValue
      }
      return acc
    }, {})
}

const normalizeSkuAttrValueMapping = (raw?: Record<string, string>) => {
  if (!raw || typeof raw !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, String(value ?? '')]).filter(([, value]) => Boolean(value)),
  )
}

const resolveSelectedSaleAttrs = (currentSkuId: string) => {
  if (!saleAttrs.value.length || !Object.keys(skuAttrValueMapping.value).length) {
    return {}
  }

  const targetEntry = Object.entries(skuAttrValueMapping.value).find(
    ([, value]) => String(value || '') === currentSkuId,
  )
  if (!targetEntry) {
    return {}
  }

  const selectedMap = parseMappingKey(targetEntry[0])
  const isComplete = saleAttrs.value.every((attr) => selectedMap[attr.attrId])
  return isComplete ? selectedMap : {}
}

const buildCombinationKey = (selection: SelectedSaleAttrMap) => {
  if (!saleAttrs.value.length) {
    return ''
  }

  const entries = [...saleAttrs.value].sort((left, right) => compareAttrId(left.attrId, right.attrId)).map((attr) => {
    const value = selection[attr.attrId]
    return value ? `${attr.attrId}:${value}` : ''
  })

  return entries.every(Boolean) ? entries.join('_') : ''
}

const resolveTargetSkuId = (attrId: string, nextValue: string) => {
  if (!canSwitchSkuByAttr.value) {
    return ''
  }

  const nextSelection = {
    ...selectedSaleAttrMap.value,
    [attrId]: nextValue,
  }
  const combinationKey = buildCombinationKey(nextSelection)
  return combinationKey ? skuAttrValueMapping.value[combinationKey] || '' : ''
}

const resetFlashState = () => {
  inFlashSale.value = false
  flashLoading.value = false
  flashDetailLoading.value = false
  flashError.value = ''
  flashActionMessage.value = ''
  flashSessions.value = []
  activeSessionId.value = ''
  activeSessionDetail.value = null
  flashNavigating.value = false
  autoRefreshedFlashKey = ''
  syncFlashNow()
  resetFlashTimer()
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
  flashActionMessage.value = ''

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
  actionMessage.value = ''
  productItem.value = null
  activeImageUrl.value = ''
  skuAttrValueMapping.value = {}
  selectedSaleAttrMap.value = {}
  selectedCount.value = preservedCountOnSwitch && preservedCountOnSwitch > 0 ? preservedCountOnSwitch : 1
  resetFlashState()

  if (!currentSkuId) {
    errorMessage.value = '商品编号缺失'
    switchingSku.value = false
    preservedCountOnSwitch = null
    return
  }

  loading.value = true
  try {
    const [productRes, flashRes] = await Promise.all([getSkuItem(currentSkuId), isSkuInFlashSale(currentSkuId)])

    if (serial !== loadSerial) {
      return
    }

    productItem.value = productRes.data || null
    if (!productItem.value?.skuInfo) {
      errorMessage.value = '未找到商品详情'
      return
    }

    const currentSpuId = String(productItem.value.skuInfo.spuId || '')
    if (currentSpuId) {
      try {
        const mappingRes = await getSpuSkuAttrsMapping(currentSpuId)
        if (serial !== loadSerial) {
          return
        }
        skuAttrValueMapping.value = normalizeSkuAttrValueMapping(mappingRes.data)
      } catch {
        if (serial !== loadSerial) {
          return
        }
        skuAttrValueMapping.value = {}
      }
    }

    selectedSaleAttrMap.value = resolveSelectedSaleAttrs(currentSkuId)

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
      switchingSku.value = false
      preservedCountOnSwitch = null
    }
  }
}

const chooseImage = (url: string) => {
  activeImageUrl.value = url
}

const isSaleAttrSelected = (attrId: string, value: string) => {
  return selectedSaleAttrMap.value[attrId] === value
}

const isSaleAttrDisabled = (attrId: string, value: string) => {
  if (switchingSku.value || !canSwitchSkuByAttr.value) {
    return true
  }
  if (isSaleAttrSelected(attrId, value)) {
    return false
  }
  return !resolveTargetSkuId(attrId, value)
}

const selectSaleAttr = async (attrId: string, value: string) => {
  if (switchingSku.value || isSaleAttrSelected(attrId, value)) {
    return
  }

  const targetSkuId = resolveTargetSkuId(attrId, value)
  if (!targetSkuId || targetSkuId === skuId.value) {
    return
  }

  switchingSku.value = true
  preservedCountOnSwitch = selectedCount.value

  try {
    await router.push({ name: 'productDetail', params: { skuId: targetSkuId } })
  } catch {
    switchingSku.value = false
    preservedCountOnSwitch = null
  }
}

const selectFlashSession = (session: FlashSaleSession) => {
  const targetId = String(session.id || '')
  if (!targetId || targetId === activeSessionId.value) {
    return
  }
  flashActionMessage.value = ''
  activeSessionId.value = targetId
  void fetchSessionDetail(targetId, undefined, true)
}

const changeCount = (delta: number) => {
  if (submittingCart.value) {
    return
  }
  selectedCount.value = Math.max(1, Math.min(selectedCount.value + delta, activeFlashLimit.value))
}

const handleAddToCart = async () => {
  const info = skuInfo.value
  if (!info?.skuId || submittingCart.value) {
    return
  }

  submittingCart.value = true
  actionMessage.value = ''

  try {
    await addCartItem({
      skuId: String(info.skuId),
      count: selectedCount.value,
    })

    await router.push({
      name: 'cartSuccess',
      query: {
        skuId: String(info.skuId),
        title: info.skuTitle || info.skuName || '商品',
        image: currentImage.value,
        price: String(info.price ?? ''),
        count: String(selectedCount.value),
      },
    })
  } catch (error) {
    actionMessage.value = toErrorMessage(error, '加入购物车失败，请稍后重试')
  } finally {
    submittingCart.value = false
  }
}

const handleFlashPurchase = async () => {
  if (
    flashNavigating.value ||
    flashActionState.value !== 'ready' ||
    !activeSessionId.value ||
    !skuId.value ||
    !hasFlashData.value
  ) {
    return
  }

  flashNavigating.value = true
  flashActionMessage.value = ''

  try {
    await router.push({
      name: 'flashSaleConfirm',
      query: {
        sessionId: activeSessionId.value,
        skuId: skuId.value,
        num: String(selectedCount.value),
      },
    })
  } catch {
    flashActionMessage.value = '跳转秒杀确认页失败，请稍后重试'
  } finally {
    flashNavigating.value = false
  }
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

watch(
  () => activeFlashSku.value?.seckillLimit,
  () => {
    if (!Number.isFinite(activeFlashLimit.value)) {
      return
    }
    selectedCount.value = Math.max(1, Math.min(selectedCount.value, activeFlashLimit.value))
  },
  { immediate: true },
)

watch(
  [flashStatus, () => activeSession.value?.id, () => activeSession.value?.startTime],
  () => {
    syncFlashNow()
    setupFlashTimer()
    const refreshKey = `${activeSessionId.value}-${skuId.value}-${activeSession.value?.startTime || ''}`
    if (
      flashStatus.value === 'running' &&
      hasFlashData.value &&
      !activeFlashSku.value?.randomCode &&
      activeSessionId.value &&
      refreshKey !== autoRefreshedFlashKey
    ) {
      autoRefreshedFlashKey = refreshKey
      void fetchSessionDetail(activeSessionId.value, undefined, true)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  resetFlashTimer()
})
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
          </div>

          <p v-if="actionMessage" class="action-message">{{ actionMessage }}</p>

          <div class="purchase-panel">
            <div class="purchase-label">购买数量</div>
            <div class="purchase-controls">
              <div class="quantity-controller" aria-label="购买数量选择器">
                <button type="button" class="btn-qty" :disabled="submittingCart || selectedCount <= 1" @click="changeCount(-1)">
                  -
                </button>
                <span class="qty-value">{{ selectedCount }}</span>
                <button type="button" class="btn-qty" :disabled="!canIncreaseCount" @click="changeCount(1)">+</button>
              </div>
              <button class="btn-add-cart" type="button" :disabled="submittingCart" @click="handleAddToCart">
                {{ submittingCart ? '加入中...' : '加入购物车' }}
              </button>
              <button
                v-if="inFlashSale"
                class="btn-flash"
                type="button"
                :disabled="flashActionState !== 'ready'"
                @click="handleFlashPurchase"
              >
                {{ flashActionText }}
              </button>
            </div>
            <p v-if="Number.isFinite(activeFlashLimit)" class="purchase-tip">
              当前秒杀限购 {{ activeFlashLimit }} 件
            </p>
            <p v-if="flashActionMessage" class="purchase-tip error">{{ flashActionMessage }}</p>
          </div>

          <div class="attr-list" v-if="saleAttrs.length">
            <div class="attr-row" v-for="attr in saleAttrs" :key="`${attr.attrId}-${attr.attrName}`">
              <label>{{ attr.attrName }}</label>
              <div class="chips">
                <button
                  v-for="value in attr.values"
                  :key="value"
                  type="button"
                  class="chip"
                  :class="{
                    selected: isSaleAttrSelected(attr.attrId, value),
                    disabled: isSaleAttrDisabled(attr.attrId, value),
                  }"
                  :disabled="isSaleAttrDisabled(attr.attrId, value)"
                  @click="selectSaleAttr(attr.attrId, value)"
                >
                  {{ value }}
                </button>
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
                <p v-if="flashStatus === 'upcoming' && flashCountdownText">
                  距离开抢：<strong>{{ flashCountdownText }}</strong>
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

.action-message {
  margin: 14px 0 0;
  padding: 10px 12px;
  border-radius: 10px;
  color: #b12637;
  background: #fff2f4;
  border: 1px solid #ffd5da;
}

.purchase-panel {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #f0d6d9;
  border-radius: 14px;
  background: linear-gradient(180deg, #fffafa 0%, #fff 100%);
}

.purchase-label {
  font-size: 14px;
  color: #6b7280;
}

.purchase-controls {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.quantity-controller {
  display: inline-flex;
  align-items: center;
  border: 1px solid #e4d5d7;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.btn-qty {
  width: 44px;
  height: 44px;
  border: none;
  background: #fff7f8;
  color: #9a2231;
  font-size: 22px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.btn-qty:hover:not(:disabled) {
  background: #ffe9ec;
}

.btn-qty:disabled {
  cursor: not-allowed;
  color: #d0a2a8;
  background: #fbf3f4;
}

.qty-value {
  min-width: 54px;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: #222a35;
}

.btn-add-cart {
  height: 46px;
  padding: 0 26px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #d22839, #971624);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(151, 22, 36, 0.18);
}

.btn-add-cart:disabled {
  cursor: not-allowed;
  background: linear-gradient(135deg, #efb4bb, #d8929b);
  box-shadow: none;
}

.btn-flash {
  height: 46px;
  padding: 0 22px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #ff8a00, #d9480f);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(217, 72, 15, 0.18);
}

.btn-flash:disabled {
  cursor: not-allowed;
  background: linear-gradient(135deg, #f2c7a3, #dca77b);
  box-shadow: none;
}

.purchase-tip {
  margin: 10px 0 0;
  font-size: 13px;
  color: #677182;
}

.purchase-tip.error {
  color: #b12637;
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
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease,
    opacity 0.2s ease;
}

.chip.selected {
  border-color: #d66f7c;
  background: #fff1f3;
  color: #a11e2d;
  box-shadow: inset 0 0 0 1px rgba(193, 32, 47, 0.14);
}

.chip.disabled {
  cursor: not-allowed;
  color: #9aa3b2;
  background: #f7f8fb;
  border-color: #eceff5;
  opacity: 0.72;
}

.chip:not(:disabled):hover {
  border-color: #dca3aa;
  background: #fff7f8;
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

  .purchase-controls,
  .attr-row {
    grid-template-columns: 1fr;
  }

  .purchase-controls {
    display: grid;
  }

  .btn-add-cart {
    width: 100%;
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
