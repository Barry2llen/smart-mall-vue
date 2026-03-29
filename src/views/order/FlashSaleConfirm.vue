<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCurrentUserId } from '@/api/auth'
import {
  getFlashSaleOrderConfirm,
  getFlashSaleSessionById,
  submitFlashSaleOrder,
  type FlashSaleMemberReceiveAddress,
  type FlashSaleOrderConfirm,
  type SessionRelatedSkuInfoVO,
} from '@/api/flashSale'

defineOptions({ name: 'FlashSaleConfirmPage' })

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const errorMessage = ref('')
const confirmData = ref<FlashSaleOrderConfirm | null>(null)
const selectedAddressId = ref<string | null>(null)
const notes = ref('')
const submitting = ref(false)
const submitError = ref('')
const currentUserId = ref('')
const randomCode = ref('')

const sessionId = computed(() => {
  const value = route.query.sessionId
  return typeof value === 'string' ? value : ''
})

const skuId = computed(() => {
  const value = route.query.skuId
  return typeof value === 'string' ? value : ''
})

const purchaseNum = computed(() => {
  const value = route.query.num
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
})

const selectedAddress = computed(
  () => confirmData.value?.addresses?.find((item) => item.id === selectedAddressId.value) ?? null,
)

const fullAddress = (addr: FlashSaleMemberReceiveAddress) =>
  `${addr.province ?? ''}${addr.city ?? ''}${addr.region ?? ''}${addr.detailAddress ?? ''}`

const formatPrice = (value?: number) => `¥${Number(value || 0).toFixed(2)}`

const resolveRandomCodeFromSession = (skuInfos?: SessionRelatedSkuInfoVO[]) => {
  const target = (skuInfos || []).find((item) => String(item.skuId || '') === skuId.value)
  return String(target?.randomCode || '')
}

const ensureValidParams = () => {
  if (!sessionId.value || !skuId.value || purchaseNum.value <= 0) {
    errorMessage.value = '秒杀参数缺失，请返回商品页重新发起抢购'
    return false
  }
  return true
}

const loadUserId = async () => {
  const userId = await getCurrentUserId()
  if (typeof userId !== 'string' || !userId || /^\s*<!doctype html>|^\s*<html[\s>]/i.test(userId)) {
    throw new Error('请先登录后再参与秒杀')
  }
  currentUserId.value = userId
}

const loadRandomCode = async () => {
  const res = await getFlashSaleSessionById(sessionId.value, true)
  randomCode.value = resolveRandomCodeFromSession(res.data?.skuInfos)
  return randomCode.value
}

const loadConfirm = async () => {
  if (!ensureValidParams()) {
    return
  }

  loading.value = true
  errorMessage.value = ''
  submitError.value = ''

  try {
    await loadUserId()
    const [confirmRes] = await Promise.all([
      getFlashSaleOrderConfirm(currentUserId.value, sessionId.value, skuId.value, purchaseNum.value),
      loadRandomCode(),
    ])
    confirmData.value = confirmRes.data || null
    const addresses = confirmData.value?.addresses || []
    const defaultAddress = addresses.find((item) => item.defaultStatus === 1)
    selectedAddressId.value = (defaultAddress || addresses[0])?.id || null
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '加载秒杀确认信息失败'
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
    return
  }
  void router.push({ name: 'productDetail', params: { skuId: skuId.value } })
}

const handleSubmit = async () => {
  if (!confirmData.value || !selectedAddressId.value || !currentUserId.value || submitting.value) {
    return
  }

  submitting.value = true
  submitError.value = ''

  try {
    let code = randomCode.value
    if (!code) {
      code = await loadRandomCode()
    }
    if (!code) {
      throw new Error('秒杀随机码获取失败，请返回商品页重新尝试')
    }

    await submitFlashSaleOrder(currentUserId.value, {
      skuId: skuId.value,
      sessionId: sessionId.value,
      randomCode: code,
      num: purchaseNum.value,
      addressId: selectedAddressId.value,
      note: notes.value || undefined,
    })

    await router.push({ name: 'orderList' })
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : '提交秒杀订单失败'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void loadConfirm()
})
</script>

<template>
  <main class="confirm-page">
    <div class="confirm-container">
      <header class="confirm-header">
        <button class="btn-back" type="button" @click="goBack">返回</button>
        <div>
          <h1 class="page-title">秒杀订单确认</h1>
          <p class="page-subtitle">提交成功后将进入订单列表，待付款订单可继续支付</p>
        </div>
      </header>

      <div v-if="loading" class="empty-state">
        <div class="spinner"></div>
        <p>正在加载秒杀订单信息...</p>
      </div>

      <div v-else-if="errorMessage" class="empty-state error">
        <p>{{ errorMessage }}</p>
        <button class="btn-retry" type="button" @click="loadConfirm">重新加载</button>
      </div>

      <template v-else-if="confirmData?.item">
        <section class="section-card">
          <div class="section-header">
            <h2 class="section-title">收货地址</h2>
          </div>
          <div v-if="!confirmData.addresses.length" class="no-address">暂无收货地址</div>
          <div v-else class="address-list">
            <div
              v-for="addr in confirmData.addresses"
              :key="addr.id"
              class="address-item"
              :class="{ active: selectedAddressId === addr.id }"
              @click="selectedAddressId = addr.id"
            >
              <div class="address-top">
                <span class="addr-name">{{ addr.name }}</span>
                <span class="addr-phone">{{ addr.phone }}</span>
                <span v-if="addr.defaultStatus === 1" class="tag-default">默认</span>
              </div>
              <p class="addr-detail">{{ fullAddress(addr) }}</p>
            </div>
          </div>
        </section>

        <section class="section-card">
          <div class="section-header">
            <h2 class="section-title">秒杀商品</h2>
          </div>
          <div class="item-list">
            <div class="order-item">
              <div class="item-image-wrapper">
                <img class="item-image" :src="confirmData.item.image" :alt="confirmData.item.title" />
              </div>
              <div class="item-info">
                <h3 class="item-title">{{ confirmData.item.title }}</h3>
                <p class="item-sku">{{ confirmData.item.skuAttr?.join(' / ') || '默认规格' }}</p>
                <div class="item-footer">
                  <div class="item-price-wrap">
                    <span class="price-symbol">¥</span>
                    <span class="price-value">{{ Number(confirmData.item.price || 0).toFixed(2) }}</span>
                  </div>
                  <span class="item-qty">× {{ confirmData.item.count }}</span>
                  <div class="item-total">
                    小计 <strong>{{ formatPrice(confirmData.item.totalPrice) }}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="section-card">
          <div class="section-header">
            <h2 class="section-title">订单备注</h2>
          </div>
          <textarea
            v-model="notes"
            class="notes-input"
            maxlength="200"
            rows="3"
            placeholder="选填，可以告诉卖家您的特殊需求"
          ></textarea>
        </section>

        <section class="section-card summary-card">
          <div class="section-header">
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
            <li class="summary-row">
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
              {{ submitting ? '提交中...' : '提交秒杀订单' }}
            </button>
          </div>
        </footer>

        <div v-if="submitError" class="submit-error">{{ submitError }}</div>
      </template>
    </div>
  </main>
</template>

<style scoped>
.confirm-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(255, 219, 184, 0.45), transparent 30%),
    #f5f7fa;
  padding: 24px 20px 120px;
  color: #333;
}

.confirm-container {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.confirm-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.btn-back {
  height: 38px;
  padding: 0 16px;
  border: 1px solid #e1e6ef;
  border-radius: 999px;
  background: #fff;
  color: #5d6676;
  cursor: pointer;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.page-subtitle {
  margin: 6px 0 0;
  color: #8a93a3;
  font-size: 13px;
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
  gap: 14px;
}

.empty-state.error {
  color: #f56c6c;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #ff7a45;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.btn-retry {
  border: 1px solid #ffd0bd;
  background: #fff7f3;
  color: #d9480f;
  padding: 8px 18px;
  border-radius: 8px;
  cursor: pointer;
}

.section-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03);
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.no-address {
  color: #909399;
  text-align: center;
  padding: 20px 0;
}

.address-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.address-item {
  border: 2px solid #ebeef5;
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.address-item.active {
  border-color: #ff7a45;
  background: #fff7f3;
}

.address-top {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.addr-name {
  font-weight: 600;
}

.addr-phone {
  color: #606266;
}

.tag-default {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  color: #fff;
  background: linear-gradient(135deg, #ff8a00, #d9480f);
}

.addr-detail {
  margin: 0;
  color: #303133;
  line-height: 1.5;
}

.item-list {
  display: flex;
  flex-direction: column;
}

.order-item {
  display: flex;
  gap: 16px;
}

.item-image-wrapper {
  width: 88px;
  height: 88px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #ebeef5;
  background: #f4f4f5;
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
  margin: 0 0 6px;
  font-size: 15px;
  line-height: 1.4;
}

.item-sku {
  margin: 0 0 12px;
  display: inline-block;
  font-size: 12px;
  color: #909399;
  background: #f4f4f5;
  padding: 2px 8px;
  border-radius: 4px;
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
  color: #ff4d4f;
  margin-right: 2px;
}

.price-value {
  color: #ff4d4f;
  font-size: 18px;
  font-weight: 700;
}

.item-qty {
  color: #909399;
}

.item-total {
  margin-left: auto;
  color: #606266;
}

.notes-input {
  width: 100%;
  box-sizing: border-box;
  min-height: 72px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 12px 14px;
  resize: vertical;
  outline: none;
}

.notes-input:focus {
  border-color: #ff7a45;
}

.summary-card {
  background: linear-gradient(135deg, #fff 0%, #fff8f4 100%);
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
}

.pay-row {
  padding-top: 12px;
  border-top: 2px solid #f0f0f0;
}

.pay-total,
.submit-total-price {
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

.submit-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  border-top: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.06);
}

.submit-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  color: #909399;
}

.submit-address {
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submit-right {
  display: flex;
  align-items: center;
  gap: 18px;
}

.submit-total-wrap {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.submit-total-label {
  color: #606266;
}

.btn-submit {
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #ff8a00, #d9480f);
  color: #fff;
  padding: 12px 28px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(217, 72, 15, 0.28);
}

.btn-submit:disabled {
  background: linear-gradient(135deg, #f2c7a3, #dca77b);
  box-shadow: none;
  cursor: not-allowed;
}

.submit-error {
  text-align: center;
  color: #f56c6c;
  background: #fef0f0;
  border-radius: 8px;
  padding: 8px 16px;
}

@media (max-width: 768px) {
  .confirm-page {
    padding: 16px 12px 130px;
  }

  .confirm-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .submit-bar {
    flex-direction: column;
    align-items: stretch;
    padding: 12px 16px;
  }

  .submit-right {
    width: 100%;
    justify-content: space-between;
  }

  .btn-submit {
    padding-left: 20px;
    padding-right: 20px;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
