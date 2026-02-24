<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  checkCartItem,
  deleteCartItem,
  getCart,
  type Cart,
  type CartItemVO,
  updateCartItemCount,
  uncheckCartItem,
} from '@/api/cart'

defineOptions({
  name: 'CartPage',
})

const loading = ref(false)
const errorMessage = ref('')
const actionMessage = ref('')
const cart = ref<Cart | null>(null)
const pendingSkuIds = ref<number[]>([])
const countOverrides = ref<Record<number, number>>({})
const selectedOverrides = ref<Record<number, boolean>>({})
const silentRefreshTimer = ref<number | null>(null)
const summaryCalculating = ref(true)
const summarySyncing = ref(false)
const countDebounceTimers = new Map<number, number>()
const selectedDebounceTimers = new Map<number, number>()

const DEBOUNCE_DELAY = 400
const SILENT_REFRESH_DELAY = 800

const formatPrice = (value?: number) => {
  return `¥${Number(value || 0).toFixed(2)}`
}

const getDisplayedCount = (item: CartItemVO) => {
  return countOverrides.value[item.skuId] ?? item.count
}

const getDisplayedSelected = (item: CartItemVO) => {
  return selectedOverrides.value[item.skuId] ?? item.selected
}

const cartItems = computed(() => cart.value?.items || [])

const isOutOfStock = (item: CartItemVO) => {
  return item.stock != null && item.stock <= getDisplayedCount(item)
}

const selectedTypeCount = computed(() => {
  return cartItems.value.filter((item) => getDisplayedSelected(item)).length
})

const selectedItemCount = computed(() => {
  return cartItems.value.reduce((sum, item) => {
    if (!getDisplayedSelected(item)) {
      return sum
    }
    return sum + Number(getDisplayedCount(item) || 0)
  }, 0)
})

const allSelected = computed(() => {
  return cartItems.value.length > 0 && selectedTypeCount.value === cartItems.value.length
})


const displayTotalAmount = computed(() => {
  return cartItems.value.reduce((sum, item) => {
    if (!getDisplayedSelected(item)) {
      return sum
    }
    return sum + Number(item.price || 0) * Number(getDisplayedCount(item) || 0)
  }, 0)
})

const displayReduce = computed(() => Number(cart.value?.reduce || 0))

const displayPayableAmount = computed(() => {
  return Math.max(displayTotalAmount.value - displayReduce.value, 0)
})

const checkoutDisabled = computed(() => {
  return (
    cartItems.value.length === 0 ||
    selectedTypeCount.value === 0 ||
    displayPayableAmount.value <= 0
  )
})

const recalculateCartSummary = () => {
  if (!cart.value) {
    return
  }

  const items = cart.value.items || []
  cart.value.countType = items.length
  cart.value.countNumber = items.reduce((sum, item) => sum + Number(item.count || 0), 0)
  cart.value.totalAmount = items.reduce(
    (sum, item) =>
      item.selected
        ? sum + Number(item.totalPrice || Number(item.price || 0) * Number(item.count || 0))
        : sum,
    0,
  )
}

const loadCart = async (options?: { silent?: boolean }) => {
  const silent = Boolean(options?.silent)
  if (!silent) {
    loading.value = true
    errorMessage.value = ''
    summaryCalculating.value = true
  }
  try {
    cart.value = await getCart()
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '加载购物车失败'
    if (silent) {
      actionMessage.value = msg
    } else {
      errorMessage.value = msg
    }
  } finally {
    if (!silent) {
      loading.value = false
      summaryCalculating.value = false
    }
  }
}

const handleRefresh = () => {
  if (silentRefreshTimer.value) {
    clearTimeout(silentRefreshTimer.value)
    silentRefreshTimer.value = null
  }
  summarySyncing.value = false
  void loadCart()
}

const markPending = (skuId: number) => {
  if (!pendingSkuIds.value.includes(skuId)) {
    pendingSkuIds.value = [...pendingSkuIds.value, skuId]
  }
}

const clearPending = (skuId: number) => {
  pendingSkuIds.value = pendingSkuIds.value.filter((id) => id !== skuId)
}

const isPending = (skuId: number) => {
  return pendingSkuIds.value.includes(skuId)
}

const removeCountOverride = (skuId: number) => {
  const nextOverrides = { ...countOverrides.value }
  delete nextOverrides[skuId]
  countOverrides.value = nextOverrides
}

const removeSelectedOverride = (skuId: number) => {
  const nextOverrides = { ...selectedOverrides.value }
  delete nextOverrides[skuId]
  selectedOverrides.value = nextOverrides
}

const clearSkuTimer = (timers: Map<number, number>, skuId: number) => {
  const timer = timers.get(skuId)
  if (timer) {
    clearTimeout(timer)
  }
  timers.delete(skuId)
}

const scheduleSkuDebounce = (timers: Map<number, number>, skuId: number, task: () => void) => {
  clearSkuTimer(timers, skuId)
  const timer = window.setTimeout(() => {
    timers.delete(skuId)
    task()
  }, DEBOUNCE_DELAY)
  timers.set(skuId, timer)
}

const removeCountTimer = (skuId: number) => {
  clearSkuTimer(countDebounceTimers, skuId)
}

const removeSelectedTimer = (skuId: number) => {
  clearSkuTimer(selectedDebounceTimers, skuId)
}

const scheduleSilentRefresh = () => {
  if (silentRefreshTimer.value) {
    clearTimeout(silentRefreshTimer.value)
  }
  summarySyncing.value = true
  silentRefreshTimer.value = window.setTimeout(() => {
    silentRefreshTimer.value = null
    void loadCart({ silent: true }).finally(() => {
      summarySyncing.value = false
    })
  }, SILENT_REFRESH_DELAY)
}

const syncSelected = (skuId: number, selected: boolean, previousSelected: boolean) => {
  if (cart.value) {
    cart.value.items = (cart.value.items || []).map((item) =>
      item.skuId === skuId ? { ...item, selected } : item,
    )
  }
  removeSelectedOverride(skuId)

  const request = selected ? checkCartItem(skuId) : uncheckCartItem(skuId)

  void request
    .catch((error: unknown) => {
      if (cart.value) {
        cart.value.items = (cart.value.items || []).map((item) =>
          item.skuId === skuId ? { ...item, selected: previousSelected } : item,
        )
      }
      actionMessage.value = error instanceof Error ? error.message : '更新选中状态失败'
    })
    .finally(() => {
      scheduleSilentRefresh()
    })
}

const syncCount = (skuId: number, nextCount: number, previousCount: number) => {
  if (cart.value) {
    cart.value.items = (cart.value.items || []).map((item) =>
      item.skuId === skuId
        ? {
            ...item,
            count: nextCount,
            totalPrice: Number(item.price || 0) * nextCount,
          }
        : item,
    )
    recalculateCartSummary()
  }
  removeCountOverride(skuId)

  void updateCartItemCount(skuId, nextCount)
    .catch((error: unknown) => {
      if (cart.value) {
        cart.value.items = (cart.value.items || []).map((item) =>
          item.skuId === skuId
            ? {
                ...item,
                count: previousCount,
                totalPrice: Number(item.price || 0) * previousCount,
              }
            : item,
        )
        recalculateCartSummary()
      }
      actionMessage.value = error instanceof Error ? error.message : '修改商品数量失败'
    })
    .finally(() => {
      scheduleSilentRefresh()
    })
}

const queueSelectedChange = (item: CartItemVO, nextSelected: boolean) => {
  if (isPending(item.skuId)) {
    return
  }

  const previousSelected = getDisplayedSelected(item)
  if (nextSelected === previousSelected) {
    return
  }

  selectedOverrides.value = {
    ...selectedOverrides.value,
    [item.skuId]: nextSelected,
  }

  scheduleSkuDebounce(selectedDebounceTimers, item.skuId, () => {
    syncSelected(item.skuId, nextSelected, previousSelected)
  })
}

const handleToggleAll = () => {
  if (!cartItems.value.length) {
    return
  }
  actionMessage.value = ''
  const nextSelected = !allSelected.value
  cartItems.value.forEach((item) => {
    queueSelectedChange(item, nextSelected)
  })
}

const handleToggleSelected = (item: CartItemVO) => {
  actionMessage.value = ''
  queueSelectedChange(item, !getDisplayedSelected(item))
}

const handleDelete = async (item: CartItemVO) => {
  actionMessage.value = ''
  removeCountTimer(item.skuId)
  removeSelectedTimer(item.skuId)
  removeCountOverride(item.skuId)
  removeSelectedOverride(item.skuId)
  markPending(item.skuId)
  try {
    await deleteCartItem(item.skuId)
    if (cart.value) {
      cart.value.items = (cart.value.items || []).filter((current) => current.skuId !== item.skuId)
      recalculateCartSummary()
    }
    scheduleSilentRefresh()
  } catch (error: unknown) {
    actionMessage.value = error instanceof Error ? error.message : '删除商品失败'
  } finally {
    clearPending(item.skuId)
  }
}

const handleChangeCount = (item: CartItemVO, nextCount: number) => {
  const previousCount = getDisplayedCount(item)
  if (isPending(item.skuId) || nextCount < 1 || nextCount === previousCount) {
    return
  }

  actionMessage.value = ''
  countOverrides.value = {
    ...countOverrides.value,
    [item.skuId]: nextCount,
  }

  scheduleSkuDebounce(countDebounceTimers, item.skuId, () => {
    syncCount(item.skuId, nextCount, previousCount)
  })
}

const router = useRouter()

const handleCheckout = () => {
  void router.push({ name: 'orderConfirm' })
}

onMounted(() => {
  loadCart()
})

onBeforeUnmount(() => {
  countDebounceTimers.forEach((timer) => clearTimeout(timer))
  selectedDebounceTimers.forEach((timer) => clearTimeout(timer))
  if (silentRefreshTimer.value) {
    clearTimeout(silentRefreshTimer.value)
  }
  summarySyncing.value = false
})
</script>

<template>
  <main class="cart-page">
    <div class="cart-container">
      <header class="cart-header">
        <h1 class="page-title">购物车</h1>
        <button class="btn-refresh" type="button" @click="handleRefresh" :disabled="loading">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          刷新
        </button>
      </header>

      <div v-if="actionMessage" class="toast-message error">{{ actionMessage }}</div>

      <div v-if="loading" class="empty-state">
        <div class="spinner"></div>
        <p>正在加载购物车...</p>
      </div>
      
      <div v-else-if="errorMessage" class="empty-state error">
        <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>{{ errorMessage }}</p>
      </div>

      <div v-else-if="!cart || !cart.items || cart.items.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" width="64" height="64" stroke="#dcdfe6" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        <p>购物车空空如也，快去挑点宝贝吧</p>
      </div>

      <template v-else>
        <div class="cart-list has-bottom-bar">
          <article v-for="item in cart.items" :key="item.skuId" class="cart-item" :class="{ 'out-of-stock': isOutOfStock(item) }">
            <label class="item-checkbox">
              <input
                type="checkbox"
                class="custom-checkbox"
                :checked="getDisplayedSelected(item)"
                :disabled="isPending(item.skuId)"
                @change="handleToggleSelected(item)"
              />
            </label>
            
            <div class="item-image-wrapper">
              <img class="item-image" :src="item.image" :alt="item.title" />
            </div>

            <div class="item-info">
              <div class="item-header">
                <h2 class="item-title" :title="item.title">{{ item.title }}</h2>
                <button
                  class="btn-delete"
                  type="button"
                  title="删除商品"
                  :disabled="isPending(item.skuId)"
                  @click="handleDelete(item)"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
              
              <p class="item-sku">{{ item.skuAttr?.join(' / ') || '默认规格' }}</p>

              <div v-if="isOutOfStock(item)" class="stock-warning" :class="{ 'stock-critical': item.stock! < getDisplayedCount(item) }">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <span v-if="item.stock! < getDisplayedCount(item)">库存不足（仅剩 {{ item.stock }} 件）</span>
                <span v-else>库存紧张（仅剩 {{ item.stock }} 件）</span>
              </div>
              
              <div class="item-footer">
                <div class="item-price-wrap">
                  <span class="price-symbol">¥</span>
                  <span class="price-value">{{ Number(item.price || 0).toFixed(2) }}</span>
                </div>
                
                <div class="quantity-controller">
                  <button
                    class="btn-qty"
                    type="button"
                    :disabled="isPending(item.skuId) || getDisplayedCount(item) <= 1"
                    @click="handleChangeCount(item, getDisplayedCount(item) - 1)"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  </button>
                  <span class="qty-input">{{ getDisplayedCount(item) }}</span>
                  <button
                    class="btn-qty"
                    type="button"
                    :disabled="isPending(item.skuId) || (item.stock != null && getDisplayedCount(item) >= item.stock)"
                    @click="handleChangeCount(item, getDisplayedCount(item) + 1)"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>

        <footer class="checkout-bar">
          <div class="checkout-left">
            <label class="select-all-wrap">
              <input
                type="checkbox"
                class="custom-checkbox"
                :checked="allSelected"
                :disabled="!cartItems.length"
                @change="handleToggleAll"
              />
              <span class="select-all-text">全选</span>
            </label>
            <div class="summary-info">
              <span class="summary-text">
                已选 <strong class="highlight">{{ selectedItemCount }}</strong> 件
              </span>
              <span v-if="displayReduce > 0" class="reduce-tag">
                已减 {{ formatPrice(displayReduce) }}
              </span>
            </div>
            <span v-if="summarySyncing" class="sync-status">计算中...</span>
          </div>

          <div class="checkout-right">
            <div class="total-wrap">
              <span class="total-label">合计:</span>
              <div class="total-price">
                <span class="price-symbol">¥</span>
                <span class="price-value">{{ Number(displayPayableAmount).toFixed(2) }}</span>
              </div>
            </div>
            <button class="btn-checkout" type="button" :disabled="checkoutDisabled" @click="handleCheckout">
              去结算
            </button>
          </div>
        </footer>
      </template>
    </div>
  </main>
</template>

<style scoped>
/* 基础变量与全局重置 */
.cart-page {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 24px 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #333;
}

.cart-container {
  max-width: 900px;
  margin: 0 auto;
}

/* 头部样式 */
.cart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
}

.btn-refresh {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border: 1px solid #dcdfe6;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}

.btn-refresh:hover:not(:disabled) {
  color: #409eff;
  border-color: #c6e2ff;
  background-color: #ecf5ff;
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 提示信息与空状态 */
.toast-message {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  background-color: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fde2e2;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  background: #fff;
  border-radius: 12px;
  color: #909399;
  font-size: 15px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}

.empty-state.error {
  color: #f56c6c;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #409eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* 商品列表 */
.cart-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cart-list.has-bottom-bar {
  padding-bottom: 100px;
}

/* 商品卡片 */
.cart-item {
  display: flex;
  align-items: stretch;
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
  transition: box-shadow 0.3s ease;
}

.cart-item:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

/* 库存不足样式 */
.cart-item.out-of-stock {
  border: 1.5px solid #ff7875;
  background: linear-gradient(135deg, #fff2f0 0%, #fff7f5 100%);
  box-shadow: 0 2px 12px rgba(255, 77, 79, 0.08);
  position: relative;
}

.cart-item.out-of-stock::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 36px 36px 0;
  border-color: transparent #ff4d4f transparent transparent;
  border-radius: 0 12px 0 0;
}

.cart-item.out-of-stock::after {
  content: '!';
  position: absolute;
  top: 4px;
  right: 8px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

.cart-item.out-of-stock .item-image-wrapper {
  opacity: 0.65;
}

.cart-item.out-of-stock:hover {
  box-shadow: 0 6px 16px rgba(255, 77, 79, 0.12);
}

.stock-warning {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #d46b08;
  background: #fff7e6;
  border: 1px solid #ffd591;
  animation: stock-pulse 2s ease-in-out infinite;
}

.stock-warning.stock-critical {
  color: #cf1322;
  background: #fff1f0;
  border-color: #ffa39e;
}

@keyframes stock-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* 复选框通用样式 */
.custom-checkbox {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid #dcdfe6;
  border-radius: 50%;
  outline: none;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  background-color: #fff;
}

.custom-checkbox:checked {
  background-color: #ff4d4f;
  border-color: #ff4d4f;
}

.custom-checkbox:checked::after {
  content: '';
  position: absolute;
  top: 4px;
  left: 6px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.custom-checkbox:disabled {
  background-color: #f5f7fa;
  border-color: #e4e7ed;
  cursor: not-allowed;
}

.item-checkbox {
  display: flex;
  align-items: center;
  padding-right: 16px;
}

/* 商品图片 */
.item-image-wrapper {
  width: 100px;
  height: 100px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  background: #f4f4f5;
  border: 1px solid #ebeef5;
}

.item-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 商品信息区 */
.item-info {
  flex: 1;
  margin-left: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0; /* 防止文本溢出撑破 flex */
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.item-title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: #303133;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-delete {
  background: transparent;
  border: none;
  color: #909399;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-delete:hover:not(:disabled) {
  color: #f56c6c;
  background-color: #fef0f0;
}

.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.item-sku {
  margin: 6px 0 0 0;
  font-size: 13px;
  color: #909399;
  background: #f4f4f5;
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
}

/* 价格与数量控制器 */
.item-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 12px;
}

.price-symbol {
  font-size: 14px;
  margin-right: 2px;
  color: #ff4d4f;
}

.price-value {
  font-size: 20px;
  font-weight: 600;
  color: #ff4d4f;
}

.quantity-controller {
  display: flex;
  align-items: center;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.btn-qty {
  width: 28px;
  height: 28px;
  background: #f5f7fa;
  border: none;
  color: #606266;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-qty:hover:not(:disabled) {
  background: #e4e7ed;
}

.btn-qty:disabled {
  color: #c0c4cc;
  cursor: not-allowed;
  background: #f5f7fa;
}

.qty-input {
  width: 40px;
  text-align: center;
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

/* 底部结算栏 */
.checkout-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 72px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-top: 1px solid rgba(220, 223, 230, 0.5);
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.04);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 5%;
  z-index: 100;
}

.checkout-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.select-all-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.select-all-text {
  font-size: 14px;
  color: #606266;
}

.summary-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.summary-text {
  font-size: 14px;
  color: #606266;
}

.highlight {
  color: #ff4d4f;
  font-weight: 600;
  margin: 0 2px;
}

.reduce-tag {
  font-size: 12px;
  color: #ff4d4f;
  background: #fff0f0;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #ffccc7;
}

.sync-status {
  font-size: 12px;
  color: #909399;
}

.checkout-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.total-wrap {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.total-label {
  font-size: 14px;
  color: #303133;
}

.total-price .price-value {
  font-size: 24px;
}

.btn-checkout {
  background: linear-gradient(135deg, #ff7a45, #ff4d4f);
  color: #fff;
  border: none;
  border-radius: 36px;
  height: 44px;
  padding: 0 32px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 12px rgba(255, 77, 79, 0.3);
}

.btn-checkout:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(255, 77, 79, 0.4);
}

.btn-checkout:disabled {
  background: #ffccc7;
  box-shadow: none;
  cursor: not-allowed;
  transform: none;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .cart-page {
    padding: 16px 12px;
  }
  
  .cart-item {
    padding: 16px 12px;
  }
  
  .item-image-wrapper {
    width: 80px;
    height: 80px;
  }
  
  .item-title {
    font-size: 14px;
  }

  .item-sku {
    font-size: 12px;
  }
  
  .checkout-bar {
    padding: 0 16px;
  }
  
  .summary-info {
    display: none; /* 移动端空间有限，隐藏件数详情，全选旁边足够 */
  }
  
  .btn-checkout {
    padding: 0 20px;
    height: 40px;
    font-size: 15px;
  }
}

@media (max-width: 480px) {
  .checkout-bar {
    flex-direction: column;
    height: auto;
    padding: 12px 16px;
    gap: 12px;
  }
  
  .checkout-left, .checkout-right {
    width: 100%;
    justify-content: space-between;
  }
  
  .cart-list.has-bottom-bar {
    padding-bottom: 120px;
  }
}
</style>