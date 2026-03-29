<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  getOrderList,
  redirectToOrderPay,
  type OrderListSkuItem,
  type OrderWithItems,
} from '@/api/order'

defineOptions({ name: 'OrderListPage' })

type OrderStatusTab = 'all' | '0' | '1' | '2' | '3' | '4' | '5'

type SkuDisplayItem = OrderListSkuItem

const SUMMARY_SKU_LIMIT = 2

const loading = ref(false)
const errorMessage = ref('')
const rawOrderList = ref<OrderWithItems[]>([])
const pageNum = ref(1)
const pageSize = ref(10)
const hasMore = ref(true)
const activeStatus = ref<OrderStatusTab>('all')
const keywordInput = ref('')
const searchKeyword = ref('')
const expandedOrderSnSet = ref(new Set<string>())
const loadMoreTrigger = ref<HTMLElement | null>(null)
let loadMoreObserver: IntersectionObserver | null = null

const router = useRouter()

const statusMap: Record<string, { label: string; class: string }> = {
  '0': { label: '待付款', class: 'status-pending' },
  '1': { label: '待发货', class: 'status-processing' },
  '2': { label: '已发货', class: 'status-shipped' },
  '3': { label: '已完成', class: 'status-success' },
  '4': { label: '已关闭', class: 'status-closed' },
  '5': { label: '无效订单', class: 'status-invalid' },
}

const statusTabs: Array<{ key: OrderStatusTab; label: string }> = [
  { key: 'all', label: '全部' },
  { key: '0', label: '待付款' },
  { key: '1', label: '待发货' },
  { key: '2', label: '已发货' },
  { key: '3', label: '已完成' },
  { key: '4', label: '已关闭' },
  { key: '5', label: '无效订单' },
]

const formatPrice = (value?: number) => `¥${Number(value || 0).toFixed(2)}`
const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const normalizeStatus = (status?: string | number | null) => {
  if (status === undefined || status === null || status === '') {
    return ''
  }
  return String(status)
}

const getStatusInfo = (status?: string | number | null) =>
  statusMap[normalizeStatus(status)] || { label: '未知状态', class: 'status-unknown' }

const orderList = computed(() => rawOrderList.value)

const isFilterActive = computed(() => activeStatus.value !== 'all' || !!searchKeyword.value.trim())

const currentQuery = computed(() => ({
  pageNum: pageNum.value,
  pageSize: pageSize.value,
  status: activeStatus.value === 'all' ? undefined : Number(activeStatus.value),
  keyword: searchKeyword.value.trim() || undefined,
}))

const flattenSkus = (orderData: OrderWithItems): SkuDisplayItem[] => {
  return (orderData.items || []).flatMap((spu) => spu.spuItems || [])
}

const getSkuItems = (orderData: OrderWithItems) => flattenSkus(orderData)

const getVisibleSkuItems = (orderData: OrderWithItems) => {
  const items = getSkuItems(orderData)
  if (expandedOrderSnSet.value.has(orderData.order.orderSn)) return items
  return items.slice(0, SUMMARY_SKU_LIMIT)
}

const getHiddenSkuCount = (orderData: OrderWithItems) => {
  const hiddenCount = getSkuItems(orderData).length - SUMMARY_SKU_LIMIT
  return hiddenCount > 0 ? hiddenCount : 0
}

const getTotalQuantity = (orderData: OrderWithItems) =>
  getSkuItems(orderData).reduce((sum, sku) => sum + Number(sku.skuQuantity || 0), 0)

const isExpanded = (orderSn: string) => expandedOrderSnSet.value.has(orderSn)

const toggleExpand = (orderSn: string) => {
  if (expandedOrderSnSet.value.has(orderSn)) {
    expandedOrderSnSet.value.delete(orderSn)
  } else {
    expandedOrderSnSet.value.add(orderSn)
  }
  expandedOrderSnSet.value = new Set(expandedOrderSnSet.value)
}

const goDetail = (orderData: OrderWithItems) => {
  void router.push({
    name: 'orderDetail',
    params: { orderSn: orderData.order.orderSn },
    state: { orderData: JSON.stringify(orderData) },
  })
}

const goPay = (orderData: OrderWithItems) => {
  redirectToOrderPay(orderData.order.orderSn)
}

const viewLogistics = (orderData: OrderWithItems) => {
  void router.push({
    name: 'orderDetail',
    params: { orderSn: orderData.order.orderSn },
  })
}

const loadOrders = async (isLoadMore = false) => {
  if (loading.value) return

  if (!isLoadMore) {
    pageNum.value = 1
    rawOrderList.value = []
    expandedOrderSnSet.value = new Set()
    hasMore.value = true
  }

  if (!hasMore.value) return

  loading.value = true
  errorMessage.value = ''
  try {
    const res = await getOrderList(currentQuery.value)
    if (res && res.length > 0) {
      rawOrderList.value = isLoadMore ? [...rawOrderList.value, ...res] : res
      if (res.length < pageSize.value) {
        hasMore.value = false
      }
    } else {
      hasMore.value = false
    }
  } catch (e: unknown) {
    errorMessage.value = e instanceof Error ? e.message : '加载订单列表失败'
  } finally {
    loading.value = false
  }
}

const handleRefresh = () => {
  loadOrders()
}

const handleLoadMore = () => {
  if (!loading.value && hasMore.value) {
    pageNum.value += 1
    loadOrders(true)
  }
}

const handleTabChange = (status: OrderStatusTab) => {
  if (activeStatus.value === status) return
  activeStatus.value = status
  loadOrders()
}

const handleSearch = () => {
  const keyword = keywordInput.value.trim()
  if (keyword === searchKeyword.value) return
  searchKeyword.value = keyword
  loadOrders()
}

const handleClearSearch = () => {
  if (!keywordInput.value && !searchKeyword.value) return
  keywordInput.value = ''
  searchKeyword.value = ''
  loadOrders()
}

const resetLoadMoreObserver = () => {
  if (loadMoreObserver) {
    loadMoreObserver.disconnect()
    loadMoreObserver = null
  }
}

const setupLoadMoreObserver = () => {
  resetLoadMoreObserver()
  if (!hasMore.value || !loadMoreTrigger.value) return
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return

  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (entry?.isIntersecting) {
        handleLoadMore()
      }
    },
    { root: null, rootMargin: '140px 0px', threshold: 0.1 },
  )

  loadMoreObserver.observe(loadMoreTrigger.value)
}

watch(
  () => [hasMore.value, loading.value, orderList.value.length, loadMoreTrigger.value] as const,
  async () => {
    await nextTick()
    setupLoadMoreObserver()
  },
  { flush: 'post' },
)

onMounted(() => {
  loadOrders()
})

onBeforeUnmount(() => {
  resetLoadMoreObserver()
})
</script>

<template>
  <main class="order-list-page">
    <div class="order-list-container">
      <header class="page-header">
        <div>
          <h1 class="page-title">全部订单</h1>
          <p class="page-subtitle">按状态快速筛选，优先处理待办订单</p>
        </div>
        <button class="btn-refresh" type="button" @click="handleRefresh" :disabled="loading">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            stroke="currentColor"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          刷新
        </button>
      </header>

      <section class="status-tabs">
        <button
          v-for="tab in statusTabs"
          :key="tab.key"
          type="button"
          class="tab-btn"
          :class="{ active: activeStatus === tab.key }"
          @click="handleTabChange(tab.key)"
        >
          <span>{{ tab.label }}</span>
        </button>
      </section>

      <section class="search-bar">
        <input
          v-model="keywordInput"
          class="search-input"
          type="text"
          maxlength="64"
          placeholder="输入订单号前缀进行检索"
          @keyup.enter="handleSearch"
        />
        <button class="btn-search" type="button" :disabled="loading" @click="handleSearch">
          检索
        </button>
        <button
          v-if="keywordInput || searchKeyword"
          class="btn-clear"
          type="button"
          :disabled="loading"
          @click="handleClearSearch"
        >
          清空
        </button>
      </section>

      <div v-if="errorMessage && !rawOrderList.length" class="empty-state error">
        <svg
          viewBox="0 0 24 24"
          width="48"
          height="48"
          stroke="currentColor"
          stroke-width="1.5"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>{{ errorMessage }}</p>
        <button class="btn-retry" type="button" @click="handleRefresh">重新加载</button>
      </div>

      <div v-else-if="!loading && !rawOrderList.length" class="empty-state">
        <svg
          viewBox="0 0 24 24"
          width="64"
          height="64"
          stroke="#dcdfe6"
          stroke-width="1"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
          <path
            d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
          ></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
        <p>暂无订单记录</p>
      </div>

      <div v-else-if="!loading && !orderList.length" class="empty-state tab-empty">
        <p>{{ isFilterActive ? '未检索到匹配订单' : '当前筛选下暂无订单' }}</p>
        <p v-if="searchKeyword" class="tab-empty-tip">关键词：{{ searchKeyword }}</p>
      </div>

      <div v-else class="order-list">
        <article v-for="orderData in orderList" :key="orderData.order.id" class="order-card">
          <div class="card-header">
            <div class="header-left">
              <span class="order-time">{{ formatDate(orderData.order.createTime) }}</span>
              <span class="order-sn">订单号：{{ orderData.order.orderSn }}</span>
            </div>
            <span class="order-status" :class="getStatusInfo(orderData.order.status).class">
              {{ getStatusInfo(orderData.order.status).label }}
            </span>
          </div>

          <div class="card-body">
            <div
              v-for="(sku, index) in getVisibleSkuItems(orderData)"
              :key="`${orderData.order.orderSn}-${sku.skuId}-${index}`"
              class="order-item"
            >
              <div class="item-image-wrapper">
                <img class="item-image" :src="sku.skuPic" :alt="sku.skuName" />
              </div>
              <div class="item-info">
                <h3 class="item-title" :title="sku.skuName">{{ sku.skuName }}</h3>
                <p class="item-sku">
                  {{
                    sku.skuAttrsVals
                      ? sku.skuAttrsVals
                          .split('/')
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .join(' / ')
                      : '默认规格'
                  }}
                </p>
                <div class="item-price-row">
                  <span class="item-price">{{ formatPrice(sku.skuPrice) }}</span>
                  <span class="item-count">× {{ sku.skuQuantity }}</span>
                  <span class="item-subtotal">
                    小计 {{ formatPrice((sku.realAmount ?? 0) || sku.skuPrice * sku.skuQuantity) }}
                  </span>
                </div>
              </div>
            </div>

            <button
              v-if="getHiddenSkuCount(orderData) > 0"
              class="btn-expand"
              type="button"
              @click="toggleExpand(orderData.order.orderSn)"
            >
              {{
                isExpanded(orderData.order.orderSn)
                  ? '收起商品'
                  : `展开其余 ${getHiddenSkuCount(orderData)} 件商品`
              }}
            </button>
          </div>

          <div class="card-footer">
            <div class="footer-left">
              <span class="receiver-info">共 {{ getTotalQuantity(orderData) }} 件商品</span>
              <span v-if="orderData.order.receiverName" class="receiver-info">
                收货人：{{ orderData.order.receiverName }}
              </span>
            </div>
            <div class="footer-right">
              <div class="total-wrap">
                <span class="total-label">实付款</span>
                <span class="total-price">{{ formatPrice(orderData.order.payAmount) }}</span>
              </div>
              <div class="action-buttons">
                <button
                  v-if="normalizeStatus(orderData.order.status) === '0'"
                  class="btn btn-primary"
                  type="button"
                  @click="goPay(orderData)"
                >
                  立即支付
                </button>
                <button
                  v-if="normalizeStatus(orderData.order.status) === '2'"
                  class="btn btn-default"
                  type="button"
                  @click="viewLogistics(orderData)"
                >
                  查看物流
                </button>
                <button class="btn btn-default" type="button" @click="goDetail(orderData)">
                  查看详情
                </button>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div v-if="rawOrderList.length > 0" class="load-more-wrap">
        <div ref="loadMoreTrigger" class="load-trigger"></div>
        <div v-if="loading" class="spinner small"></div>
        <button v-else-if="hasMore" class="btn-load-more" type="button" @click="handleLoadMore">
          加载更多
        </button>
        <p v-else class="no-more-data">没有更多订单了</p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.order-list-page {
  min-height: 100vh;
  background: radial-gradient(circle at top right, #fff4f4, transparent 38%), #f5f7fa;
  padding: 24px 20px 36px;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #333;
}

.order-list-container {
  max-width: 920px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  gap: 16px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
}

.page-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: #909399;
}

.btn-refresh {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border: 1px solid #dcdfe6;
  padding: 8px 14px;
  border-radius: 9px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  transition: all 0.2s;
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

.status-tabs {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.tab-btn {
  border: 1px solid #e8ebf2;
  background: #fff;
  border-radius: 10px;
  min-height: 46px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #606266;
  font-size: 13px;
  transition: all 0.2s;
}

.tab-btn:hover {
  border-color: #c6e2ff;
  color: #409eff;
}

.tab-btn.active {
  border-color: #ff8d8d;
  background: linear-gradient(180deg, #fff, #fff6f6);
  color: #d93d3f;
  box-shadow: 0 2px 8px rgba(255, 77, 79, 0.12);
}

.search-bar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 38px;
  border: 1px solid #dcdfe6;
  border-radius: 10px;
  padding: 0 12px;
  font-size: 13px;
  color: #303133;
  background: #fff;
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #ff8d8d;
  box-shadow: 0 0 0 3px rgba(255, 77, 79, 0.1);
}

.btn-search,
.btn-clear {
  height: 38px;
  border-radius: 10px;
  padding: 0 16px;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-search {
  border-color: #ffb8b8;
  color: #d93d3f;
  background: #fff7f7;
}

.btn-search:hover:not(:disabled),
.btn-clear:hover:not(:disabled) {
  border-color: #c6e2ff;
  color: #409eff;
  background-color: #ecf5ff;
}

.btn-search:disabled,
.btn-clear:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 78px 0;
  background: #fff;
  border-radius: 12px;
  color: #909399;
  font-size: 15px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  gap: 14px;
}

.empty-state.error {
  color: #f56c6c;
}

.tab-empty {
  min-height: 180px;
}

.tab-empty-tip {
  margin: 0;
  font-size: 13px;
  color: #c0c4cc;
}

.btn-retry {
  background: #fff;
  border: 1px solid #dcdfe6;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-retry:hover {
  color: #409eff;
  border-color: #c6e2ff;
  background-color: #ecf5ff;
}

.order-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.order-card {
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 3px 14px rgba(17, 24, 39, 0.05);
  overflow: hidden;
  transition: box-shadow 0.25s ease, transform 0.25s ease;
}

.order-card:hover {
  box-shadow: 0 10px 24px rgba(17, 24, 39, 0.09);
  transform: translateY(-1px);
}

.card-header {
  padding: 14px 20px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: linear-gradient(180deg, #fcfcfc, #f8f9fb);
}

.header-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: #606266;
}

.order-sn {
  color: #909399;
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.order-status {
  font-size: 13px;
  font-weight: 600;
}

.status-pending {
  color: #f56c6c;
}
.status-processing {
  color: #e6a23c;
}
.status-shipped {
  color: #409eff;
}
.status-success {
  color: #67c23a;
}
.status-closed,
.status-invalid {
  color: #909399;
}
.status-unknown {
  color: #606266;
}

.card-body {
  padding: 16px 20px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.order-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.item-image-wrapper {
  width: 76px;
  height: 76px;
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

.item-info {
  flex: 1;
  min-width: 0;
}

.item-title {
  margin: 0;
  font-size: 14px;
  color: #303133;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-sku {
  margin: 6px 0 8px;
  font-size: 12px;
  color: #909399;
}

.item-price-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.item-price {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.item-count {
  font-size: 12px;
  color: #909399;
}

.item-subtotal {
  margin-left: auto;
  font-size: 12px;
  color: #606266;
}

.btn-expand {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: transparent;
  color: #409eff;
  font-size: 13px;
  cursor: pointer;
}

.btn-expand:hover {
  color: #2d8cf0;
}

.card-footer {
  padding: 14px 20px 18px;
  border-top: 1px solid #f4f5f7;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 14px;
}

.footer-left {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 13px;
  color: #909399;
}

.receiver-info {
  line-height: 1.4;
}

.footer-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.total-wrap {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.total-label {
  font-size: 13px;
  color: #909399;
}

.total-price {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 7px 16px;
  border-radius: 18px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-default {
  background: #fff;
  border: 1px solid #dcdfe6;
  color: #606266;
}

.btn-default:hover {
  border-color: #c0c4cc;
  color: #303133;
}

.btn-primary {
  background: linear-gradient(135deg, #ff6b6b, #ff4d4f);
  border: none;
  color: #fff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(255, 77, 79, 0.22);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 77, 79, 0.3);
}

.load-more-wrap {
  margin-top: 22px;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 40px;
  position: relative;
}

.load-trigger {
  position: absolute;
  top: -80px;
  width: 100%;
  height: 1px;
  pointer-events: none;
}

.btn-load-more {
  background: transparent;
  border: 1px solid #dcdfe6;
  color: #606266;
  padding: 8px 24px;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-load-more:hover {
  color: #409eff;
  border-color: #c6e2ff;
  background-color: #ecf5ff;
}

.no-more-data {
  color: #909399;
  font-size: 13px;
}

.spinner.small {
  width: 24px;
  height: 24px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #909399;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .status-tabs {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .order-list-page {
    padding: 16px 12px 28px;
  }

  .page-header {
    align-items: center;
  }

  .page-title {
    font-size: 22px;
  }

  .status-tabs {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .search-bar {
    gap: 8px;
  }

  .btn-search,
  .btn-clear {
    padding: 0 12px;
  }

  .card-header,
  .card-body,
  .card-footer {
    padding-left: 14px;
    padding-right: 14px;
  }

  .card-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .footer-right {
    width: 100%;
    align-items: flex-start;
  }

  .action-buttons {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .total-price {
    font-size: 20px;
  }
}

@media (max-width: 480px) {
  .status-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .search-bar {
    flex-wrap: wrap;
  }

  .search-input {
    width: 100%;
  }

  .btn-refresh {
    padding: 7px 12px;
    font-size: 12px;
  }

  .order-item {
    gap: 10px;
  }

  .item-image-wrapper {
    width: 64px;
    height: 64px;
  }

  .item-title {
    font-size: 13px;
  }

  .action-buttons .btn {
    padding: 6px 12px;
    font-size: 12px;
  }
}
</style>
