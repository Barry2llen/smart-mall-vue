<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

defineOptions({ name: 'CartSuccessPage' })

const route = useRoute()
const router = useRouter()

const countdown = ref(3)
let timer: number | null = null

const getSingleQuery = (value: unknown) => {
  if (Array.isArray(value)) {
    return value[0] || ''
  }
  return typeof value === 'string' ? value : ''
}

const skuId = computed(() => getSingleQuery(route.query.skuId))
const title = computed(() => getSingleQuery(route.query.title) || '商品')
const image = computed(() => getSingleQuery(route.query.image))
const count = computed(() => {
  const raw = Number(getSingleQuery(route.query.count))
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1
})
const price = computed(() => {
  const raw = Number(getSingleQuery(route.query.price))
  return Number.isFinite(raw) ? raw : null
})
const hasSummary = computed(() => Boolean(skuId.value || image.value || title.value))

const formatPrice = (value: number | null) => {
  if (value == null) {
    return '--'
  }
  return `¥${value.toFixed(2)}`
}

const stopTimer = () => {
  if (timer) {
    window.clearInterval(timer)
    timer = null
  }
}

const goCart = () => {
  stopTimer()
  void router.push({ name: 'cart' })
}

const goProductDetail = () => {
  stopTimer()
  if (skuId.value) {
    void router.push({ name: 'productDetail', params: { skuId: skuId.value } })
    return
  }
  void router.push({ name: 'home' })
}

onMounted(() => {
  timer = window.setInterval(() => {
    if (countdown.value <= 1) {
      goCart()
      return
    }
    countdown.value -= 1
  }, 1000)
})

onBeforeUnmount(() => {
  stopTimer()
})
</script>

<template>
  <main class="success-page">
    <section class="success-card">
      <div class="success-badge">SUCCESS</div>
      <h1>成功加入购物车</h1>
      <p class="success-desc">
        {{ countdown }} 秒后自动跳转到购物车，你也可以现在继续处理。
      </p>

      <article v-if="hasSummary" class="product-summary">
        <div class="summary-image-wrap">
          <img v-if="image" :src="image" :alt="title" />
          <div v-else class="summary-image-empty">商品</div>
        </div>

        <div class="summary-content">
          <h2>{{ title }}</h2>
          <p>加入数量：{{ count }}</p>
          <p v-if="price != null">单价：{{ formatPrice(price) }}</p>
        </div>
      </article>

      <div class="action-row">
        <button type="button" class="primary-btn" @click="goCart">去购物车</button>
        <button type="button" class="secondary-btn" @click="goProductDetail">返回商品详情</button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.success-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at 10% 10%, rgba(234, 88, 12, 0.16), transparent 28%),
    radial-gradient(circle at 90% 0%, rgba(190, 24, 93, 0.18), transparent 24%),
    linear-gradient(180deg, #fff8f4 0%, #fff 100%);
}

.success-card {
  width: min(760px, 100%);
  padding: 36px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(234, 88, 12, 0.12);
  box-shadow: 0 24px 80px rgba(146, 64, 14, 0.12);
}

.success-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 88px;
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: #fff1e8;
  color: #c2410c;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.success-card h1 {
  margin: 18px 0 0;
  font-size: 36px;
  line-height: 1.15;
  color: #18181b;
}

.success-desc {
  margin: 12px 0 0;
  color: #52525b;
  font-size: 16px;
}

.product-summary {
  margin-top: 28px;
  padding: 18px;
  border-radius: 20px;
  background: linear-gradient(135deg, #fff7ed, #fff);
  border: 1px solid #fed7aa;
  display: grid;
  grid-template-columns: 132px 1fr;
  gap: 18px;
}

.summary-image-wrap {
  width: 132px;
  height: 132px;
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #ffedd5;
  display: grid;
  place-items: center;
}

.summary-image-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.summary-image-empty {
  color: #9a3412;
  font-weight: 700;
}

.summary-content h2 {
  margin: 0;
  font-size: 22px;
  line-height: 1.4;
  color: #18181b;
}

.summary-content p {
  margin: 10px 0 0;
  color: #52525b;
  font-size: 15px;
}

.action-row {
  margin-top: 28px;
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.primary-btn,
.secondary-btn {
  height: 46px;
  padding: 0 22px;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.primary-btn {
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #ea580c, #be123c);
  box-shadow: 0 12px 32px rgba(190, 24, 93, 0.24);
}

.secondary-btn {
  border: 1px solid #fdba74;
  color: #9a3412;
  background: #fff;
}

@media (max-width: 640px) {
  .success-card {
    padding: 24px;
    border-radius: 22px;
  }

  .success-card h1 {
    font-size: 28px;
  }

  .product-summary {
    grid-template-columns: 1fr;
  }

  .summary-image-wrap {
    width: 100%;
    height: 220px;
  }

  .action-row {
    display: grid;
  }
}
</style>
