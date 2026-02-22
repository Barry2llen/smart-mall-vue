<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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

const displayCountType = computed(() => cartItems.value.length)

const displayCountNumber = computed(() => {
  return cartItems.value.reduce((sum, item) => sum + Number(getDisplayedCount(item) || 0), 0)
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
    <section class="cart-wrap">
      <header class="cart-header">
        <h1>我的购物车</h1>
        <button class="reload-btn" type="button" @click="handleRefresh" :disabled="loading">刷新</button>
      </header>
      <p v-if="actionMessage" class="action-message">{{ actionMessage }}</p>

      <div v-if="loading" class="state-box">正在加载购物车...</div>
      <div v-else-if="errorMessage" class="state-box error-box">{{ errorMessage }}</div>
      <div v-else-if="!cart || !cart.items || cart.items.length === 0" class="state-box">
        购物车还是空的，快去逛逛吧
      </div>
      <template v-else>
        <section class="cart-list has-bottom-bar">
          <article v-for="item in cart.items" :key="item.skuId" class="cart-item">
            <img class="item-image" :src="item.image" :alt="item.title" />
            <div class="item-main">
              <div class="item-top">
                <label class="item-check">
                  <input
                    type="checkbox"
                    :checked="getDisplayedSelected(item)"
                    :disabled="isPending(item.skuId)"
                    @change="handleToggleSelected(item)"
                  />
                  <span>选中</span>
                </label>
                <h2>{{ item.title }}</h2>
              </div>
              <p class="item-attrs">{{ item.skuAttr?.join(' / ') || '默认规格' }}</p>
              <div class="item-meta">
                <span>单价：{{ formatPrice(item.price) }}</span>
                <div class="count-control">
                  <button
                    class="count-btn"
                    type="button"
                    :disabled="isPending(item.skuId) || getDisplayedCount(item) <= 1"
                    @click="handleChangeCount(item, getDisplayedCount(item) - 1)"
                  >
                    -
                  </button>
                  <span class="count-value">{{ getDisplayedCount(item) }}</span>
                  <button
                    class="count-btn"
                    type="button"
                    :disabled="isPending(item.skuId)"
                    @click="handleChangeCount(item, getDisplayedCount(item) + 1)"
                  >
                    +
                  </button>
                </div>
                <span class="item-total">小计：{{ formatPrice(item.totalPrice) }}</span>
              </div>
              <div class="item-actions">
                <button
                  class="item-action-btn danger"
                  type="button"
                  :disabled="isPending(item.skuId)"
                  @click="handleDelete(item)"
                >
                  删除
                </button>
              </div>
            </div>
          </article>
        </section>

        <footer class="checkout-bar">
          <div class="checkout-left">
            <label class="checkout-select-all">
              <input
                type="checkbox"
                :checked="allSelected"
                :disabled="!cartItems.length"
                @change="handleToggleAll"
              />
              <span>全选</span>
            </label>
            <p class="checkout-text">
              共 {{ displayCountType }} 种 {{ displayCountNumber }} 件，已选 {{ selectedTypeCount }} 种
              {{ selectedItemCount }} 件
            </p>
            <p class="checkout-reduce">已优惠 {{ formatPrice(displayReduce) }}</p>
            <p v-if="summarySyncing" class="checkout-sync">同步中...</p>
          </div>
          <div class="checkout-right">
            <div class="checkout-price">
              <span class="checkout-label">合计：</span>
              <strong>{{ formatPrice(displayPayableAmount) }}</strong>
            </div>
            <button class="checkout-btn" type="button" :disabled="checkoutDisabled">去结算</button>
          </div>
        </footer>
      </template>
    </section>
  </main>
</template>

<style scoped>
.cart-page {
  min-height: 100vh;
  padding: 28px;
  background: radial-gradient(circle at 0 0, #eaf5ff 0, transparent 36%),
    radial-gradient(circle at 100% 100%, #fff2df 0, transparent 34%), #f7f9fd;
}

.cart-wrap {
  max-width: 1080px;
  margin: 0 auto;
  display: grid;
  gap: 16px;
}

.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

h1 {
  margin: 0;
  color: #183153;
  font-size: 34px;
}

.reload-btn {
  border: none;
  border-radius: 10px;
  height: 40px;
  min-width: 90px;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(135deg, #1178ea, #2f9bfd);
}

.reload-btn:disabled {
  background: #9ac7f3;
  cursor: not-allowed;
}

.action-message {
  margin: 0;
  color: #d94c4c;
  font-size: 14px;
}

.state-box {
  border-radius: 16px;
  border: 1px solid #dde7f4;
  background: #fff;
  color: #4f6784;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.error-box {
  color: #df4e4e;
}

.cart-list {
  display: grid;
  gap: 12px;
}

.cart-list.has-bottom-bar {
  padding-bottom: 96px;
}

.cart-item {
  border-radius: 16px;
  border: 1px solid #dfebf9;
  background: #fff;
  box-shadow: 0 10px 22px rgba(30, 65, 107, 0.08);
  padding: 16px;
  display: grid;
  grid-template-columns: 104px 1fr;
  gap: 14px;
}

.item-image {
  width: 104px;
  height: 104px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid #e5edf8;
  background: #f3f7fd;
}

.item-main {
  min-width: 0;
  display: grid;
  gap: 8px;
}

.item-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: 19px;
  color: #1f3d62;
  line-height: 1.4;
  flex: 1;
}

.item-attrs {
  margin: 0;
  color: #5f7898;
  font-size: 14px;
}

.item-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #355677;
  font-size: 13px;
  font-weight: 700;
}

.item-check input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: #1f8bff;
}

.item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  color: #2f4f75;
  font-size: 14px;
}

.item-total {
  color: #1866bf;
  font-weight: 700;
}

.count-control {
  display: inline-flex;
  align-items: center;
  border: 1px solid #cfdcf0;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.count-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: #f6f9ff;
  color: #2b4b71;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.count-btn:disabled {
  color: #9aa9bb;
  background: #f0f4fa;
  cursor: not-allowed;
}

.count-value {
  min-width: 36px;
  text-align: center;
  font-weight: 700;
  color: #234369;
}

.item-actions {
  display: flex;
  gap: 10px;
}

.item-action-btn {
  border: 1px solid #cddcf0;
  border-radius: 10px;
  background: #fff;
  color: #28486f;
  height: 34px;
  min-width: 88px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.item-action-btn.danger {
  border-color: #efc4c4;
  color: #c84545;
}

.item-action-btn:disabled {
  background: #eef3fa;
  color: #8b9bb0;
  border-color: #d9e3f1;
  cursor: not-allowed;
}

.checkout-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  height: 72px;
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid #dbe7f7;
  box-shadow: 0 -8px 24px rgba(20, 44, 74, 0.08);
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.checkout-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.checkout-select-all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  color: #2f4f75;
  font-size: 14px;
  font-weight: 700;
}

.checkout-select-all input {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: #1f8bff;
}

.checkout-select-all input:disabled + span {
  color: #9aa9bb;
}

.checkout-text {
  margin: 0;
  color: #2f4f75;
  font-size: 14px;
}

.checkout-reduce {
  margin: 0;
  color: #d76060;
  font-size: 13px;
}

.checkout-sync {
  margin: 0;
  color: #6f87a4;
  font-size: 12px;
}

.checkout-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.checkout-price {
  color: #1d3b5f;
  font-size: 14px;
}

.checkout-label {
  color: #6885a8;
}

.checkout-price strong {
  color: #e45757;
  font-size: 24px;
}

.checkout-btn {
  height: 44px;
  min-width: 120px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #ff7a00, #ff4d2e);
  color: #fff;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}

.checkout-btn:disabled {
  background: #ffbf8b;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .cart-page {
    padding: 16px 16px 86px;
  }

  h1 {
    font-size: 28px;
  }

  .cart-item {
    grid-template-columns: 84px 1fr;
    padding: 12px;
  }

  .item-image {
    width: 84px;
    height: 84px;
  }

  .checkout-bar {
    height: 80px;
    padding: 0 12px;
  }

  .checkout-price strong {
    font-size: 20px;
  }

  .checkout-btn {
    min-width: 98px;
    height: 40px;
  }
}

@media (max-width: 520px) {
  .cart-header {
    flex-direction: column;
    align-items: stretch;
  }

  .checkout-bar {
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    gap: 6px;
    height: 106px;
    padding: 8px 12px;
  }

  .checkout-right {
    justify-content: space-between;
  }
}
</style>
