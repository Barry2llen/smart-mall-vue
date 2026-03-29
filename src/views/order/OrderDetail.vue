<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getOrderBySn,
  redirectToOrderPay,
  type OrderListSkuItem,
  type OrderWithItems,
} from '@/api/order'

defineOptions({ name: 'OrderDetailPage' })

const route = useRoute()
const router = useRouter()

const orderSn = computed(() => route.params.orderSn as string)
const loading = ref(false)
const errorMessage = ref('')
const orderData = ref<OrderWithItems | null>(null)

const formatPrice = (value?: number) => `¥${Number(value || 0).toFixed(2)}`
const formatCount = (value?: number) => Number(value || 0)
const formatValue = (value?: string | number | null) => {
  if (value === undefined || value === null || value === '') return '—'
  return String(value)
}
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

const statusMap: Record<string, { label: string; class: string }> = {
  '0': { label: '待付款', class: 'status-pending' },
  '1': { label: '待发货', class: 'status-processing' },
  '2': { label: '已发货', class: 'status-shipped' },
  '3': { label: '已完成', class: 'status-success' },
  '4': { label: '已关闭', class: 'status-closed' },
  '5': { label: '无效订单', class: 'status-invalid' },
}

const normalizeStatus = (status?: string | number | null) => {
  if (status === undefined || status === null || status === '') {
    return ''
  }
  return String(status)
}

const getStatusInfo = (status?: string | number | null) =>
  statusMap[normalizeStatus(status)] || { label: '未知状态', class: 'status-unknown' }

const payTypeLabel = (payType?: string | number | null) => {
  const normalized = normalizeStatus(payType)
  return normalized === '1' ? '货到付款' : normalized === '0' ? '在线支付' : '—'
}

const sourceTypeLabel = (sourceType?: string | number | null) => {
  const normalized = normalizeStatus(sourceType)
  return normalized === '0' ? 'PC 订单' : normalized === '1' ? 'App 订单' : '—'
}

const billTypeLabel = (billType?: string | number | null) => {
  const normalized = normalizeStatus(billType)
  if (normalized === '0') return '不开发票'
  if (normalized === '1') return '电子发票'
  if (normalized === '2') return '纸质发票'
  return '—'
}

const confirmStatusLabel = (confirmStatus?: number) => {
  if (confirmStatus === 0) return '未确认收货'
  if (confirmStatus === 1) return '已确认收货'
  return '—'
}

const deleteStatusLabel = (deleteStatus?: number) => {
  if (deleteStatus === 0) return '未删除'
  if (deleteStatus === 1) return '已删除'
  return '—'
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    void router.push({ name: 'orderList' })
  }
}

const goPay = () => {
  if (!order.value?.orderSn) {
    return
  }
  redirectToOrderPay(order.value.orderSn)
}

const order = computed(() => orderData.value?.order)
const items = computed(() => orderData.value?.items ?? [])
const receiverAddress = computed(() => {
  const value = order.value
  if (!value) return '—'
  const address = [
    value.receiverProvince,
    value.receiverCity,
    value.receiverRegion,
    value.receiverDetailAddress,
  ]
    .filter(Boolean)
    .join(' ')
  return address || '—'
})

const timelineRows = computed(() => [
  { label: '下单时间', value: formatDate(order.value?.createTime) },
  { label: '支付时间', value: formatDate(order.value?.paymentTime) },
  { label: '发货时间', value: formatDate(order.value?.deliveryTime) },
  { label: '签收时间', value: formatDate(order.value?.receiveTime) },
  { label: '评价时间', value: formatDate(order.value?.commentTime) },
  { label: '更新时间', value: formatDate(order.value?.modifyTime) },
])

const getItemSubtotal = (sku: OrderListSkuItem) => {
  if (sku.realAmount !== undefined && sku.realAmount !== null) return sku.realAmount
  return Number(sku.skuPrice || 0) * Number(sku.skuQuantity || 0)
}

const loadOrder = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    orderData.value = await getOrderBySn(orderSn.value)
  } catch (e: unknown) {
    errorMessage.value = e instanceof Error ? e.message : '加载订单详情失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadOrder()
})
</script>

<template>
  <main class="detail-page">
    <div class="detail-container">
      <!-- 头部导航 -->
      <header class="page-header">
        <button class="btn-back" type="button" @click="goBack">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            stroke="currentColor"
            stroke-width="2"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          返回订单列表
        </button>
        <h1 class="page-title">订单详情</h1>
      </header>

      <!-- 加载中 -->
      <div v-if="loading" class="empty-state">
        <div class="spinner"></div>
        <p>正在加载订单信息...</p>
      </div>

      <!-- 错误状态 -->
      <div v-else-if="errorMessage" class="empty-state error">
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
        <button class="btn-retry" type="button" @click="loadOrder">重新加载</button>
      </div>

      <template v-else-if="orderData">
        <!-- 订单状态卡片 -->
        <section class="section-card status-card">
          <div class="status-banner">
            <span class="status-icon-wrap">
              <svg
                v-if="normalizeStatus(order?.status) === '0'"
                viewBox="0 0 24 24"
                width="28"
                height="28"
                stroke="currentColor"
                stroke-width="1.5"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              <svg
                v-else-if="normalizeStatus(order?.status) === '1'"
                viewBox="0 0 24 24"
                width="28"
                height="28"
                stroke="currentColor"
                stroke-width="1.5"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <svg
                v-else-if="normalizeStatus(order?.status) === '2'"
                viewBox="0 0 24 24"
                width="28"
                height="28"
                stroke="currentColor"
                stroke-width="1.5"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
              <svg
                v-else-if="normalizeStatus(order?.status) === '3'"
                viewBox="0 0 24 24"
                width="28"
                height="28"
                stroke="currentColor"
                stroke-width="1.5"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <svg
                v-else
                viewBox="0 0 24 24"
                width="28"
                height="28"
                stroke="currentColor"
                stroke-width="1.5"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </span>
            <div class="status-text-wrap">
              <span class="status-text" :class="getStatusInfo(order?.status).class">
                {{ getStatusInfo(order?.status).label }}
              </span>
              <span class="status-sn">订单号：{{ orderSn }}</span>
            </div>
          </div>
        </section>

        <!-- 收货信息 -->
        <section class="section-card">
          <div class="section-header">
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
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <h2 class="section-title">收货信息</h2>
          </div>
          <div class="info-grid">
            <div class="info-row">
              <span class="info-label">收货人</span>
              <span class="info-value">{{ formatValue(order?.receiverName) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">联系电话</span>
              <span class="info-value">{{ formatValue(order?.receiverPhone) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">邮编</span>
              <span class="info-value">{{ formatValue(order?.receiverPostCode) }}</span>
            </div>
            <div class="info-row row-wrap">
              <span class="info-label">收货地址</span>
              <span class="info-value text-left">{{ receiverAddress }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">下单时间</span>
              <span class="info-value">{{ formatDate(order?.createTime) }}</span>
            </div>
          </div>
        </section>

        <!-- 商品清单 -->
        <section class="section-card">
          <div class="section-header">
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
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
            <h2 class="section-title">商品清单</h2>
          </div>
          <div v-if="!items.length" class="no-items">暂无商品信息</div>
          <div v-else class="item-list">
            <template v-for="spu in items" :key="spu.spuId">
              <!-- SPU 品牌行 -->
              <div class="spu-brand-row">
                <img v-if="spu.spuPic" class="spu-pic" :src="spu.spuPic" :alt="spu.spuBrand" />
                <span class="spu-brand">{{ spu.spuBrand || spu.spuName }}</span>
              </div>
              <!-- SKU 行 -->
              <div v-for="sku in spu.spuItems" :key="sku.skuId" class="order-item">
                <div class="item-image-wrapper">
                  <img class="item-image" :src="sku.skuPic" :alt="sku.skuName" />
                </div>
                <div class="item-info">
                  <h3 class="item-title" :title="sku.skuName">{{ sku.skuName }}</h3>
                  <div class="item-attrs">
                    <template v-if="sku.skuAttrsVals">
                      <span
                        v-for="(attr, i) in sku.skuAttrsVals
                          .split('/')
                          .map((s) => s.trim())
                          .filter(Boolean)"
                        :key="i"
                        class="attr-tag"
                        >{{ attr }}</span
                      >
                    </template>
                    <span v-else class="attr-tag">默认规格</span>
                  </div>
                  <div class="item-price-row">
                    <span class="item-price">{{ formatPrice(sku.skuPrice) }}</span>
                    <span class="item-count">× {{ sku.skuQuantity }}</span>
                    <span class="item-subtotal">
                      小计 {{ formatPrice(getItemSubtotal(sku)) }}
                    </span>
                  </div>
                  <div class="item-extra-row">
                    <span>促销优惠 {{ formatPrice(sku.promotionAmount) }}</span>
                    <span>优惠券抵扣 {{ formatPrice(sku.couponAmount) }}</span>
                    <span>积分抵扣 {{ formatPrice(sku.integrationAmount) }}</span>
                    <span>赠送积分 {{ formatCount(sku.giftIntegration) }}</span>
                    <span>赠送成长值 {{ formatCount(sku.giftGrowth) }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </section>

        <!-- 订单信息 -->
        <section class="section-card">
          <div class="section-header">
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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <h2 class="section-title">订单信息</h2>
          </div>
          <div class="info-grid">
            <div class="info-row">
              <span class="info-label">订单号</span>
              <span class="info-value mono">{{ order?.orderSn }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">订单状态</span>
              <span class="info-value" :class="getStatusInfo(order?.status).class">
                {{ getStatusInfo(order?.status).label }}
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">会员账号</span>
              <span class="info-value">{{ formatValue(order?.memberUsername) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">支付方式</span>
              <span class="info-value">{{ payTypeLabel(order?.payType) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">订单来源</span>
              <span class="info-value">{{ sourceTypeLabel(order?.sourceType) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">优惠券ID</span>
              <span class="info-value">{{ formatValue(order?.couponId) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">使用积分</span>
              <span class="info-value">{{ formatCount(order?.useIntegration) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">获得积分</span>
              <span class="info-value">{{ formatCount(order?.integration) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">获得成长值</span>
              <span class="info-value">{{ formatCount(order?.growth) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">确认收货</span>
              <span class="info-value">{{ confirmStatusLabel(order?.confirmStatus) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">删除状态</span>
              <span class="info-value">{{ deleteStatusLabel(order?.deleteStatus) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">下单时间</span>
              <span class="info-value">{{ formatDate(order?.createTime) }}</span>
            </div>
            <div class="info-row row-wrap">
              <span class="info-label">订单备注</span>
              <span class="info-value text-left">{{ formatValue(order?.note) }}</span>
            </div>
          </div>
        </section>

        <!-- 物流信息 -->
        <section class="section-card">
          <div class="section-header">
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
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
            <h2 class="section-title">物流信息</h2>
          </div>
          <div class="info-grid">
            <div class="info-row">
              <span class="info-label">物流公司</span>
              <span class="info-value">{{ formatValue(order?.deliveryCompany) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">物流单号</span>
              <span class="info-value mono">{{ formatValue(order?.deliverySn) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">发货时间</span>
              <span class="info-value">{{ formatDate(order?.deliveryTime) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">自动确认(天)</span>
              <span class="info-value">{{ formatValue(order?.autoConfirmDay) }}</span>
            </div>
          </div>
        </section>

        <!-- 发票信息 -->
        <section class="section-card">
          <div class="section-header">
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
              <path d="M9 3h6l3 3v15l-3-2-3 2-3-2-3 2V6z"></path>
            </svg>
            <h2 class="section-title">发票信息</h2>
          </div>
          <div class="info-grid">
            <div class="info-row">
              <span class="info-label">发票类型</span>
              <span class="info-value">{{ billTypeLabel(order?.billType) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">发票抬头</span>
              <span class="info-value">{{ formatValue(order?.billHeader) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">发票内容</span>
              <span class="info-value">{{ formatValue(order?.billContent) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">收票电话</span>
              <span class="info-value">{{ formatValue(order?.billReceiverPhone) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">收票邮箱</span>
              <span class="info-value">{{ formatValue(order?.billReceiverEmail) }}</span>
            </div>
          </div>
        </section>

        <!-- 时间节点 -->
        <section class="section-card">
          <div class="section-header">
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
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <h2 class="section-title">订单时间节点</h2>
          </div>
          <div class="info-grid">
            <div v-for="row in timelineRows" :key="row.label" class="info-row">
              <span class="info-label">{{ row.label }}</span>
              <span class="info-value">{{ row.value }}</span>
            </div>
          </div>
        </section>

        <!-- 费用明细 -->
        <section class="section-card summary-card">
          <div class="section-header">
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
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            <h2 class="section-title">费用明细</h2>
          </div>
          <ul class="summary-list">
            <li class="summary-row">
              <span class="summary-label">商品总额</span>
              <span class="summary-amount">{{ formatPrice(order?.totalAmount) }}</span>
            </li>
            <li class="summary-row">
              <span class="summary-label">运费</span>
              <span class="summary-amount">{{ formatPrice(order?.freightAmount) }}</span>
            </li>
            <li class="summary-row">
              <span class="summary-label">促销优惠</span>
              <span class="summary-amount discount">-{{ formatPrice(order?.promotionAmount) }}</span>
            </li>
            <li class="summary-row">
              <span class="summary-label">优惠券抵扣</span>
              <span class="summary-amount discount">-{{ formatPrice(order?.couponAmount) }}</span>
            </li>
            <li class="summary-row">
              <span class="summary-label">积分抵扣</span>
              <span class="summary-amount discount">-{{ formatPrice(order?.integrationAmount) }}</span>
            </li>
            <li class="summary-row">
              <span class="summary-label">后台折扣</span>
              <span class="summary-amount discount">-{{ formatPrice(order?.discountAmount) }}</span>
            </li>
            <li class="summary-row pay-row">
              <span class="summary-label">实付金额</span>
              <div class="pay-total">
                <span class="pay-symbol">¥</span>
                <span class="pay-value">{{ Number(order?.payAmount || 0).toFixed(2) }}</span>
              </div>
            </li>
          </ul>
        </section>

        <!-- 底部操作 -->
        <div class="bottom-actions">
          <button
            v-if="normalizeStatus(order?.status) === '0'"
            class="btn btn-primary"
            type="button"
            @click="goPay"
          >
            立即支付
          </button>
          <button class="btn btn-default" type="button" @click="goBack">返回列表</button>
        </div>
      </template>
    </div>
  </main>
</template>

<style scoped>
.detail-page {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 24px 20px 60px;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #333;
}

.detail-container {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 4px;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #fff;
  border: 1px solid #dcdfe6;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-back:hover {
  color: #409eff;
  border-color: #c6e2ff;
  background-color: #ecf5ff;
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: #1a1a1a;
}

/* 空/加载/错误状态 */
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
  gap: 16px;
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
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
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

/* 卡片通用 */
.section-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
}

/* 状态卡片 */
.status-card {
  background: linear-gradient(135deg, #fff 0%, #f9f9ff 100%);
}

.status-banner {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #f4f4f5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-text-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-text {
  font-size: 18px;
  font-weight: 600;
}

.status-sn {
  font-size: 12px;
  color: #909399;
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

/* 信息网格 */
.info-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  gap: 16px;
}

.info-label {
  color: #909399;
  flex-shrink: 0;
}

.info-value {
  color: #303133;
  font-weight: 500;
  text-align: right;
  word-break: break-all;
}

.info-value.mono {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  color: #606266;
}

.info-row.row-wrap {
  align-items: flex-start;
}

.info-value.text-left {
  text-align: left;
  white-space: normal;
}

/* 品牌行 */
.spu-brand-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0 6px;
  border-bottom: 1px dashed #f0f0f0;
  margin-bottom: 12px;
}

.spu-brand-row:first-child {
  padding-top: 0;
}

.spu-pic {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  object-fit: cover;
}

.spu-brand {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

/* 商品列表 */
.no-items {
  font-size: 14px;
  color: #909399;
  text-align: center;
  padding: 20px 0;
}

.item-list {
  display: flex;
  flex-direction: column;
}

.order-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid #f5f5f5;
}

.order-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

.item-image-wrapper {
  width: 88px;
  height: 88px;
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
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-attrs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.attr-tag {
  font-size: 11px;
  padding: 2px 8px;
  background: #f4f4f5;
  color: #909399;
  border-radius: 4px;
  border: 1px solid #ebeef5;
}

.item-price-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.item-price {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.item-count {
  font-size: 13px;
  color: #909399;
}

.item-subtotal {
  margin-left: auto;
  font-size: 13px;
  color: #606266;
}

.item-extra-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: #909399;
}

/* 费用明细 */
.summary-card {
  background: linear-gradient(135deg, #fff 0%, #fff9f9 100%);
}

.summary-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.summary-label {
  color: #606266;
}
.summary-amount {
  color: #303133;
  font-weight: 500;
}
.summary-amount.free {
  color: #67c23a;
}
.summary-amount.discount {
  color: #f56c6c;
}

.pay-row {
  padding-top: 12px;
  border-top: 2px solid #f0f0f0;
  margin-top: 4px;
}

.pay-total {
  display: flex;
  align-items: baseline;
}

.pay-symbol {
  font-size: 15px;
  font-weight: 700;
  color: #ff4d4f;
  margin-right: 2px;
}

.pay-value {
  font-size: 24px;
  font-weight: 700;
  color: #ff4d4f;
}

/* 底部操作 */
.bottom-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 4px;
}

.btn {
  padding: 10px 24px;
  border-radius: 20px;
  font-size: 14px;
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
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(255, 77, 79, 0.2);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 77, 79, 0.3);
}
</style>
