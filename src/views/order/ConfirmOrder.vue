<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  getOrderConfirm,
  redirectToOrderPay,
  submitOrder,
  type MemberReceiveAddress,
  type OrderConfirm,
} from '@/api/order'

defineOptions({ name: 'ConfirmOrderPage' })

const loading = ref(false)
const errorMessage = ref('')
const confirmData = ref<OrderConfirm | null>(null)
const selectedAddressId = ref<string | null>(null)
const notes = ref('')
const payment = ref('0')
const submitting = ref(false)
const submitError = ref('')

const formatPrice = (value?: number) => `¥${Number(value || 0).toFixed(2)}`

const fullAddress = (addr: MemberReceiveAddress) =>
  `${addr.province ?? ''}${addr.city ?? ''}${addr.region ?? ''}${addr.detailAddress ?? ''}`

const selectedAddress = computed(
  () => confirmData.value?.addresses?.find((a) => a.id === selectedAddressId.value) ?? null,
)

const loadConfirm = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    confirmData.value = await getOrderConfirm()
    // 优先选中默认地址，否则选第一个
    const addrs = confirmData.value?.addresses ?? []
    const def = addrs.find((a) => a.defaultStatus === 1)
    selectedAddressId.value = (def ?? addrs[0])?.id ?? null
  } catch (e: unknown) {
    errorMessage.value = e instanceof Error ? e.message : '加载订单信息失败'
  } finally {
    loading.value = false
  }
}

const handleSubmit = async () => {
  if (!selectedAddressId.value || !confirmData.value) return
  const token = confirmData.value.token
  if (!token) {
    submitError.value = '订单令牌缺失，请刷新重试'
    return
  }
  submitting.value = true
  submitError.value = ''
  try {
    const res = await submitOrder({
      addrId: selectedAddressId.value,
      payment: payment.value,
      token,
      price: confirmData.value.payTotal ?? 0,
      notes: notes.value || undefined,
    })
    // 响应拦截器在 code 非 0 时已 reject，走到这里说明提交成功
    const orderSn = res.data as string
    if (orderSn) {
      redirectToOrderPay(orderSn)
    } else {
      submitError.value = '提交成功但未获取到订单号'
    }
  } catch (e: unknown) {
    submitError.value = e instanceof Error ? e.message : '提交订单失败'
  } finally {
    submitting.value = false
  }
}

onMounted(loadConfirm)
</script>

<template>
  <main class="confirm-page">
    <div class="confirm-container">
      <header class="confirm-header">
        <h1 class="page-title">确认订单</h1>
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
        <button class="btn-retry" type="button" @click="loadConfirm">重新加载</button>
      </div>

      <!-- 正常内容 -->
      <template v-else-if="confirmData">
        <!-- 收货地址区 -->
        <section class="section-card">
          <div class="section-header">
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
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <h2 class="section-title">收货地址</h2>
          </div>

          <div
            v-if="!confirmData.addresses || confirmData.addresses.length === 0"
            class="no-address"
          >
            暂无收货地址
          </div>
          <div v-else class="address-list">
            <div
              v-for="addr in confirmData.addresses"
              :key="addr.id"
              class="address-item"
              :class="{ active: selectedAddressId === addr.id }"
              @click="selectedAddressId = addr.id"
            >
              <div class="address-radio">
                <span class="radio-dot" :class="{ checked: selectedAddressId === addr.id }"></span>
              </div>
              <div class="address-info">
                <div class="address-top">
                  <span class="addr-name">{{ addr.name }}</span>
                  <span class="addr-phone">{{ addr.phone }}</span>
                  <span v-if="addr.defaultStatus === 1" class="tag-default">默认</span>
                </div>
                <p class="addr-detail">{{ fullAddress(addr) }}</p>
                <p v-if="addr.postCode" class="addr-postcode">邮编：{{ addr.postCode }}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- 订单商品区 -->
        <section class="section-card">
          <div class="section-header">
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
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
            <h2 class="section-title">商品清单</h2>
            <span class="item-count">共 {{ confirmData.items?.length ?? 0 }} 件</span>
          </div>

          <div class="item-list">
            <div v-for="item in confirmData.items" :key="item.skuId" class="order-item">
              <div class="item-image-wrapper">
                <img class="item-image" :src="item.image" :alt="item.title" />
              </div>
              <div class="item-info">
                <h3 class="item-title" :title="item.title">{{ item.title }}</h3>
                <p class="item-sku">{{ item.skuAttr?.join(' / ') || '默认规格' }}</p>
                <div class="item-footer">
                  <div class="item-price-wrap">
                    <span class="price-symbol">¥</span>
                    <span class="price-value">{{ Number(item.price || 0).toFixed(2) }}</span>
                  </div>
                  <span class="item-qty">× {{ item.count }}</span>
                  <div class="item-total">
                    小计 <strong>{{ formatPrice(item.totalPrice) }}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 支付方式 -->
        <section class="section-card">
          <div class="section-header">
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
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
              <line x1="1" y1="10" x2="23" y2="10"></line>
            </svg>
            <h2 class="section-title">支付方式</h2>
          </div>
          <div class="payment-options">
            <label class="payment-option" :class="{ active: payment === '0' }">
              <input type="radio" v-model="payment" value="0" name="payment" />
              <span class="payment-radio"><span class="payment-dot"></span></span>
              <span class="payment-label">在线支付</span>
            </label>
            <label class="payment-option" :class="{ active: payment === '1' }">
              <input type="radio" v-model="payment" value="1" name="payment" />
              <span class="payment-radio"><span class="payment-dot"></span></span>
              <span class="payment-label">货到付款</span>
            </label>
          </div>
        </section>

        <!-- 订单备注 -->
        <section class="section-card">
          <div class="section-header">
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
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <h2 class="section-title">订单备注</h2>
          </div>
          <textarea
            v-model="notes"
            class="notes-input"
            placeholder="选填，可以告诉卖家您的特殊需求"
            maxlength="200"
            rows="3"
          ></textarea>
        </section>

        <!-- 金额汇总区 -->
        <section class="section-card summary-card">
          <div class="section-header">
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
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            <h2 class="section-title">费用明细</h2>
          </div>
          <ul class="summary-list">
            <li class="summary-row">
              <span class="summary-label">商品总计</span>
              <span class="summary-amount">{{ formatPrice(confirmData.total) }}</span>
            </li>
            <li class="summary-row">
              <span class="summary-label">运费</span>
              <span class="summary-amount free">免运费</span>
            </li>
            <li class="summary-row points-row">
              <span class="summary-label">获得积分</span>
              <span class="summary-amount points">+{{ confirmData.points ?? 0 }} 积分</span>
            </li>
            <li class="summary-row pay-row">
              <span class="summary-label">应付金额</span>
              <div class="pay-total">
                <span class="pay-symbol">¥</span>
                <span class="pay-value">{{ Number(confirmData.payTotal || 0).toFixed(2) }}</span>
              </div>
            </li>
          </ul>
        </section>

        <!-- 底部操作栏 -->
        <footer class="submit-bar">
          <div class="submit-info">
            <span class="submit-label">寄送至：</span>
            <span class="submit-address">
              {{ selectedAddress ? fullAddress(selectedAddress) : '请选择收货地址' }}
            </span>
          </div>
          <div class="submit-right">
            <div class="submit-total-wrap">
              <span class="submit-total-label">实付：</span>
              <div class="submit-total-price">
                <span class="pay-symbol">¥</span>
                <span class="pay-value">{{ Number(confirmData.payTotal || 0).toFixed(2) }}</span>
              </div>
            </div>
            <button
              class="btn-submit"
              type="button"
              :disabled="!selectedAddressId || submitting"
              @click="handleSubmit"
            >
              {{ submitting ? '提交中...' : '提交订单' }}
            </button>
          </div>
        </footer>

        <!-- 提交错误提示 -->
        <div v-if="submitError" class="submit-error">
          {{ submitError }}
        </div>
      </template>
    </div>
  </main>
</template>

<style scoped>
.confirm-page {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 24px 20px 120px;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #333;
}

.confirm-container {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 头部 */
.confirm-header {
  margin-bottom: 4px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
}

/* 空状态 & 错误 */
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
  margin-top: 8px;
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
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
}

.item-count {
  margin-left: auto;
  font-size: 13px;
  color: #909399;
}

/* 地址列表 */
.no-address {
  color: #909399;
  font-size: 14px;
  text-align: center;
  padding: 20px 0;
}

.address-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.address-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border: 2px solid #ebeef5;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.address-item:hover {
  border-color: #ffa0a2;
  background-color: #fff9f9;
}

.address-item.active {
  border-color: #ff4d4f;
  background-color: #fff5f5;
}

.address-radio {
  padding-top: 2px;
  flex-shrink: 0;
}

.radio-dot {
  display: block;
  width: 18px;
  height: 18px;
  border: 2px solid #dcdfe6;
  border-radius: 50%;
  position: relative;
  transition: all 0.2s;
}

.radio-dot.checked {
  border-color: #ff4d4f;
}

.radio-dot.checked::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  background: #ff4d4f;
  border-radius: 50%;
}

.address-info {
  flex: 1;
  min-width: 0;
}

.address-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.addr-name {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
}

.addr-phone {
  font-size: 14px;
  color: #606266;
}

.tag-default {
  font-size: 11px;
  padding: 2px 6px;
  background: linear-gradient(135deg, #ff6b6b, #ff4d4f);
  color: #fff;
  border-radius: 4px;
  font-weight: 500;
}

.addr-detail {
  margin: 0;
  font-size: 14px;
  color: #303133;
  line-height: 1.5;
}

.addr-postcode {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
}

/* 商品列表 */
.item-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.order-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f5f5f5;
}

.order-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
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
}

.item-title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 500;
  color: #303133;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-sku {
  margin: 0 0 10px;
  font-size: 12px;
  color: #909399;
  background: #f4f4f5;
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
}

.item-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.item-price-wrap {
  display: flex;
  align-items: baseline;
}

.price-symbol {
  font-size: 13px;
  color: #ff4d4f;
  margin-right: 1px;
}

.price-value {
  font-size: 18px;
  font-weight: 600;
  color: #ff4d4f;
}

.item-qty {
  font-size: 14px;
  color: #909399;
}

.item-total {
  margin-left: auto;
  font-size: 13px;
  color: #606266;
}

.item-total strong {
  color: #303133;
  font-weight: 600;
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

.summary-amount.points {
  color: #e6a23c;
  font-weight: 600;
}

.points-row {
  padding-top: 8px;
  border-top: 1px dashed #f0f0f0;
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

/* 底部提交栏 */
.submit-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-top: 1px solid #ebeef5;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.06);
  z-index: 100;
  gap: 12px;
}

.submit-info {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
}

.submit-label {
  flex-shrink: 0;
}

.submit-address {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #606266;
}

.submit-right {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-shrink: 0;
}

.submit-total-wrap {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.submit-total-label {
  font-size: 14px;
  color: #606266;
}

.submit-total-price {
  display: flex;
  align-items: baseline;
}

.btn-submit {
  background: linear-gradient(135deg, #ff6b6b, #ff4d4f);
  color: #fff;
  border: none;
  padding: 12px 32px;
  border-radius: 24px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  box-shadow: 0 4px 12px rgba(255, 77, 79, 0.35);
  letter-spacing: 0.5px;
}

.btn-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(255, 77, 79, 0.45);
}

.btn-submit:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(255, 77, 79, 0.3);
}

.btn-submit:disabled {
  background: linear-gradient(135deg, #e4e7ed, #c0c4cc);
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

/* 支付方式 */
.payment-options {
  display: flex;
  gap: 16px;
}

.payment-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: 2px solid #ebeef5;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
}

.payment-option:hover {
  border-color: #ffa0a2;
  background-color: #fff9f9;
}

.payment-option.active {
  border-color: #ff4d4f;
  background-color: #fff5f5;
}

.payment-option input[type='radio'] {
  display: none;
}

.payment-radio {
  width: 18px;
  height: 18px;
  border: 2px solid #dcdfe6;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.payment-option.active .payment-radio {
  border-color: #ff4d4f;
}

.payment-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: transparent;
  transition: all 0.2s;
}

.payment-option.active .payment-dot {
  background: #ff4d4f;
}

.payment-label {
  font-size: 15px;
  font-weight: 500;
  color: #303133;
}

/* 备注 */
.notes-input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-size: 14px;
  color: #303133;
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
  transition: border-color 0.2s;
  outline: none;
}

.notes-input:focus {
  border-color: #ff4d4f;
}

.notes-input::placeholder {
  color: #c0c4cc;
}

/* 提交错误 */
.submit-error {
  text-align: center;
  color: #f56c6c;
  font-size: 14px;
  padding: 8px 16px;
  background: #fef0f0;
  border-radius: 8px;
}
</style>
