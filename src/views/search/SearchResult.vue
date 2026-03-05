<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryRaw } from 'vue-router'
import {
  searchProducts,
  type Product,
  type ProductSearchParam,
  type ProductSearchResult,
  type RelatedAttr,
  type RelatedBrand,
  type RelatedCatalog,
} from '@/api/product'

defineOptions({ name: 'SearchResultPage' })

interface LocalSearchParams {
  keyword: string
  catalogId?: string
  sort: string[]
  hasStock?: 0 | 1
  skuPrice?: string
  brandIds: string[]
  attrs: string[]
  pageNum: number
  pageSize: number
}

interface AttrTag {
  attrId: string
  attrName: string
  value: string
}

const DEFAULT_PAGE_SIZE = 20
const SEARCH_DEBOUNCE = 280

const route = useRoute()
const router = useRouter()

const keywordInput = ref('')
const loadingInitial = ref(true)
const loadingList = ref(false)
const errorMessage = ref('')
const hasLoaded = ref(false)

const customMinPrice = ref('')
const customMaxPrice = ref('')

const routeSyncing = ref(false)
let requestSerial = 0
let debounceTimer: number | null = null

const searchParams = reactive<LocalSearchParams>({
  keyword: '',
  sort: [],
  brandIds: [],
  attrs: [],
  pageNum: 0,
  pageSize: DEFAULT_PAGE_SIZE,
})

const createEmptyResult = (): ProductSearchResult => ({
  products: [],
  total: 0,
  pages: 0,
  pageNum: 0,
  brands: [],
  attrs: [],
  catalogs: [],
})

const searchResult = ref<ProductSearchResult>(createEmptyResult())
const attrSelectionMap = ref<Record<string, string[]>>({})
const brandNameMap = ref<Record<string, string>>({})
const catalogNameMap = ref<Record<string, string>>({})
const attrNameMap = ref<Record<string, string>>({})

const sortOptions = [
  { key: 'default', label: '综合', value: '' },
  { key: 'priceAsc', label: '价格从低到高', value: 'skuPrice_asc' },
  { key: 'priceDesc', label: '价格从高到低', value: 'skuPrice_desc' },
  { key: 'saleCount', label: '销量优先', value: 'saleCount_desc' },
  { key: 'hotScore', label: '热度优先', value: 'hotScore_desc' },
]

const presetPrices = [
  { label: '6000以下', value: '_6000' },
  { label: '3000-6000', value: '3000_6000' },
  { label: '3000以上', value: '3000_' },
]

const toErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error ? error.message : fallback
}

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  if (typeof value === 'string') {
    return [value]
  }
  return []
}

const parseNumber = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const parseIdArrayFromQuery = (value: unknown) => {
  const source = toStringArray(value).flatMap((item) => item.split(','))
  const list = source.map((item) => item.trim()).filter(Boolean)
  return Array.from(new Set(list))
}

const parseStringArrayFromQuery = (value: unknown) => {
  const source = toStringArray(value).flatMap((item) => item.split(','))
  return source.map((item) => item.trim()).filter(Boolean)
}

const parseAttrsToSelectionMap = (attrs: string[]) => {
  const nextMap: Record<string, string[]> = {}
  attrs.forEach((item) => {
    const [attrId, valuesRaw] = item.split('_')
    if (!attrId || !valuesRaw) {
      return
    }
    const values = valuesRaw
      .split(':')
      .map((value) => value.trim())
      .filter(Boolean)
    if (values.length) {
      nextMap[attrId] = Array.from(new Set(values))
    }
  })
  return nextMap
}

const syncAttrsFromSelectionMap = () => {
  searchParams.attrs = Object.entries(attrSelectionMap.value)
    .map(([attrId, values]) => ({
      attrId,
      values: values.map((value) => value.trim()).filter(Boolean),
    }))
    .filter((item) => item.values.length)
    .map((item) => `${item.attrId}_${item.values.join(':')}`)
}

const buildQueryFromParams = (): LocationQueryRaw => {
  const query: LocationQueryRaw = {}
  if (searchParams.keyword) {
    query.keyword = searchParams.keyword
  }
  if (searchParams.pageNum > 0) {
    query.pageNum = String(searchParams.pageNum)
  }
  if (searchParams.pageSize !== DEFAULT_PAGE_SIZE) {
    query.pageSize = String(searchParams.pageSize)
  }
  if (searchParams.sort.length) {
    query.sort = [...searchParams.sort]
  }
  if (searchParams.catalogId) {
    query.catalogId = String(searchParams.catalogId)
  }
  if (searchParams.brandIds.length) {
    query.brandIds = searchParams.brandIds.map((id) => String(id))
  }
  if (searchParams.attrs.length) {
    query.attrs = [...searchParams.attrs]
  }
  if (searchParams.hasStock === 0 || searchParams.hasStock === 1) {
    query.hasStock = String(searchParams.hasStock)
  }
  if (searchParams.skuPrice) {
    query.skuPrice = searchParams.skuPrice
  }
  return query
}

const applyQueryToParams = (query: LocationQuery) => {
  const keyword = toStringArray(query.keyword)[0]?.trim() || ''
  const pageNum = parseNumber(toStringArray(query.pageNum)[0])
  const pageSize = parseNumber(toStringArray(query.pageSize)[0])
  const catalogId = toStringArray(query.catalogId)[0]?.trim() || ''
  const hasStockNum = parseNumber(toStringArray(query.hasStock)[0])
  const skuPrice = toStringArray(query.skuPrice)[0]?.trim() || ''

  let sortValues = toStringArray(query.sort)
  const firstSortValue = sortValues[0]
  if (
    sortValues.length === 1 &&
    typeof firstSortValue === 'string' &&
    firstSortValue.includes(',')
  ) {
    sortValues = firstSortValue.split(',')
  }

  const attrs = parseStringArrayFromQuery(query.attrs)

  searchParams.keyword = keyword
  keywordInput.value = keyword
  searchParams.pageNum = typeof pageNum === 'number' && pageNum >= 0 ? pageNum : 0
  searchParams.pageSize =
    typeof pageSize === 'number' && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE
  searchParams.sort = sortValues.filter(Boolean)
  searchParams.brandIds = parseIdArrayFromQuery(query.brandIds)
  searchParams.catalogId = catalogId || undefined
  searchParams.hasStock =
    hasStockNum === 0 || hasStockNum === 1 ? (hasStockNum as 0 | 1) : undefined
  searchParams.skuPrice = skuPrice || undefined
  searchParams.attrs = attrs

  attrSelectionMap.value = parseAttrsToSelectionMap(attrs)

  if (searchParams.skuPrice) {
    const [min = '', max = ''] = searchParams.skuPrice.split('_')
    customMinPrice.value = min
    customMaxPrice.value = max
  } else {
    customMinPrice.value = ''
    customMaxPrice.value = ''
  }
}

const syncRouteFromParams = async () => {
  routeSyncing.value = true
  try {
    await router.replace({
      name: 'search',
      query: buildQueryFromParams(),
    })
  } finally {
    routeSyncing.value = false
  }
}

const normalizeSearchResult = (data?: ProductSearchResult): ProductSearchResult => {
  if (!data) {
    return createEmptyResult()
  }
  return {
    products: Array.isArray(data.products) ? data.products : [],
    total: Number(data.total || 0),
    pages: Number(data.pages || 0),
    pageNum: Number(data.pageNum || 0),
    brands: Array.isArray(data.brands) ? data.brands : [],
    attrs: Array.isArray(data.attrs) ? data.attrs : [],
    catalogs: Array.isArray(data.catalogs) ? data.catalogs : [],
  }
}

const syncFilterNameMaps = (result: ProductSearchResult) => {
  const nextBrandNameMap = { ...brandNameMap.value }
  result.brands.forEach((brand) => {
    if (brand.brandId && brand.brandName) {
      nextBrandNameMap[brand.brandId] = brand.brandName
    }
  })
  brandNameMap.value = nextBrandNameMap

  const nextCatalogNameMap = { ...catalogNameMap.value }
  result.catalogs.forEach((catalog) => {
    if (catalog.catalogId && catalog.catalogName) {
      nextCatalogNameMap[catalog.catalogId] = catalog.catalogName
    }
  })
  catalogNameMap.value = nextCatalogNameMap

  const nextAttrNameMap = { ...attrNameMap.value }
  result.attrs.forEach((attr) => {
    if (attr.attrName) {
      nextAttrNameMap[String(attr.attrId)] = attr.attrName
    }
  })
  attrNameMap.value = nextAttrNameMap
}

const runSearch = async (options?: {
  resetPage?: boolean
  syncRoute?: boolean
  debounce?: boolean
}) => {
  const resetPage = Boolean(options?.resetPage)
  const needSyncRoute = options?.syncRoute !== false
  const needDebounce = Boolean(options?.debounce)

  if (resetPage) {
    searchParams.pageNum = 0
  }

  if (needSyncRoute) {
    await syncRouteFromParams()
  }

  const execute = async () => {
    const currentSerial = ++requestSerial
    if (!hasLoaded.value) {
      loadingInitial.value = true
    }
    loadingList.value = true
    errorMessage.value = ''

    try {
      const payload: ProductSearchParam = {
        keyword: searchParams.keyword || undefined,
        catalogId: searchParams.catalogId,
        sort: searchParams.sort.length ? [...searchParams.sort] : undefined,
        hasStock: searchParams.hasStock,
        skuPrice: searchParams.skuPrice,
        brandIds: searchParams.brandIds.length ? [...searchParams.brandIds] : undefined,
        attrs: searchParams.attrs.length ? [...searchParams.attrs] : undefined,
        pageNum: searchParams.pageNum,
        pageSize: searchParams.pageSize,
      }

      const response = await searchProducts(payload)
      if (currentSerial !== requestSerial) {
        return
      }

      const normalized = normalizeSearchResult(response.data)
      searchResult.value = normalized
      searchParams.pageNum = normalized.pageNum
      hasLoaded.value = true
      syncFilterNameMaps(normalized)
    } catch (error: unknown) {
      if (currentSerial !== requestSerial) {
        return
      }
      errorMessage.value = toErrorMessage(error, '搜索请求失败，请稍后再试')
      if (!hasLoaded.value) {
        searchResult.value = createEmptyResult()
      }
    } finally {
      if (currentSerial === requestSerial) {
        loadingInitial.value = false
        loadingList.value = false
      }
    }
  }

  if (needDebounce) {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null
      void execute()
    }, SEARCH_DEBOUNCE)
    return
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  await execute()
}

const isProductInStock = (product: Product) => {
  if (typeof product.hasStock === 'boolean') {
    return product.hasStock
  }
  if (typeof product.hasStock === 'number') {
    return product.hasStock === 1
  }
  return true
}

const formatPrice = (price?: number) => `¥${Number(price || 0).toFixed(2)}`

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const highlightTitle = (title: string) => {
  const safeTitle = escapeHtml(title || '')
  const keyword = searchParams.keyword.trim()
  if (!keyword) {
    return safeTitle
  }
  const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'ig')
  return safeTitle.replace(regex, '<mark>$1</mark>')
}

const activeSort = computed(() => {
  const current = searchParams.sort[0]
  if (!current) {
    return 'default'
  }
  const matched = sortOptions.find((item) => item.value === current)
  return matched?.key || 'default'
})

const selectedCatalogName = computed(() => {
  if (!searchParams.catalogId) {
    return ''
  }
  return catalogNameMap.value[searchParams.catalogId] || `分类 ${searchParams.catalogId}`
})

const selectedBrandTags = computed(() => {
  return searchParams.brandIds.map((id) => ({
    id,
    name: brandNameMap.value[id] || `品牌 ${id}`,
  }))
})

const selectedAttrTags = computed<AttrTag[]>(() => {
  return Object.entries(attrSelectionMap.value).flatMap(([attrId, values]) => {
    const attrName = attrNameMap.value[attrId] || `属性 ${attrId}`
    return values.map((value) => ({
      attrId,
      attrName,
      value,
    }))
  })
})

const hasAnySelectedFilter = computed(() => {
  return Boolean(
    searchParams.keyword ||
    searchParams.catalogId ||
    searchParams.brandIds.length ||
    selectedAttrTags.value.length ||
    searchParams.hasStock !== undefined ||
    searchParams.skuPrice,
  )
})

const totalPages = computed(() => Math.max(searchResult.value.pages, 0))
const currentPage = computed(() => searchParams.pageNum + 1)

const pageNumbers = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  if (total <= 0) {
    return []
  }
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const pages: number[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) {
    pages.push(-1)
  }
  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }
  if (end < total - 1) {
    pages.push(-2)
  }
  pages.push(total)
  return pages
})

const toggleCatalog = (catalog: RelatedCatalog) => {
  if (searchParams.catalogId === catalog.catalogId) {
    searchParams.catalogId = undefined
  } else {
    searchParams.catalogId = catalog.catalogId
    catalogNameMap.value = {
      ...catalogNameMap.value,
      [catalog.catalogId]: catalog.catalogName,
    }
  }
  void runSearch({ resetPage: true, debounce: true })
}

const toggleBrand = (brand: RelatedBrand) => {
  const selected = new Set(searchParams.brandIds)
  if (selected.has(brand.brandId)) {
    selected.delete(brand.brandId)
  } else {
    selected.add(brand.brandId)
  }
  searchParams.brandIds = Array.from(selected)
  brandNameMap.value = {
    ...brandNameMap.value,
    [brand.brandId]: brand.brandName,
  }
  void runSearch({ resetPage: true, debounce: true })
}

const toggleAttrValue = (attr: RelatedAttr, value: string) => {
  const attrId = String(attr.attrId)
  const currentValues = attrSelectionMap.value[attrId] || []
  const selected = new Set(currentValues)
  if (selected.has(value)) {
    selected.delete(value)
  } else {
    selected.add(value)
  }

  const nextMap = { ...attrSelectionMap.value }
  const nextValues = Array.from(selected)
  if (nextValues.length) {
    nextMap[attrId] = nextValues
  } else {
    delete nextMap[attrId]
  }
  attrSelectionMap.value = nextMap
  attrNameMap.value = {
    ...attrNameMap.value,
    [attrId]: attr.attrName,
  }

  syncAttrsFromSelectionMap()
  void runSearch({ resetPage: true, debounce: true })
}

const submitKeywordSearch = () => {
  searchParams.keyword = keywordInput.value.trim()
  void runSearch({ resetPage: true })
}

const clearKeyword = () => {
  keywordInput.value = ''
  searchParams.keyword = ''
  void runSearch({ resetPage: true, debounce: true })
}

const clearCatalog = () => {
  searchParams.catalogId = undefined
  void runSearch({ resetPage: true, debounce: true })
}

const handleSortChange = (sortKey: string) => {
  const target = sortOptions.find((item) => item.key === sortKey)
  if (!target) {
    return
  }
  searchParams.sort = target.value ? [target.value] : []
  void runSearch({ resetPage: true, debounce: true })
}

const toggleStockOnly = () => {
  searchParams.hasStock = searchParams.hasStock === 1 ? undefined : 1
  void runSearch({ resetPage: true, debounce: true })
}

const applyPresetPrice = (value: string) => {
  if (searchParams.skuPrice === value) {
    searchParams.skuPrice = undefined
    customMinPrice.value = ''
    customMaxPrice.value = ''
  } else {
    searchParams.skuPrice = value
    const [min = '', max = ''] = value.split('_')
    customMinPrice.value = min
    customMaxPrice.value = max
  }
  void runSearch({ resetPage: true, debounce: true })
}

const applyCustomPrice = () => {
  const min = customMinPrice.value.trim()
  const max = customMaxPrice.value.trim()

  if ((min && Number.isNaN(Number(min))) || (max && Number.isNaN(Number(max)))) {
    errorMessage.value = '价格区间仅支持数字输入'
    return
  }

  if (min && max && Number(min) > Number(max)) {
    errorMessage.value = '最低价不能高于最高价'
    return
  }

  if (!min && !max) {
    searchParams.skuPrice = undefined
  } else {
    searchParams.skuPrice = `${min}_${max}`
  }

  errorMessage.value = ''
  void runSearch({ resetPage: true })
}

const clearPriceFilter = () => {
  searchParams.skuPrice = undefined
  customMinPrice.value = ''
  customMaxPrice.value = ''
  void runSearch({ resetPage: true, debounce: true })
}

const clearAllFilters = () => {
  searchParams.catalogId = undefined
  searchParams.brandIds = []
  searchParams.attrs = []
  searchParams.hasStock = undefined
  searchParams.skuPrice = undefined
  searchParams.sort = []
  attrSelectionMap.value = {}
  customMinPrice.value = ''
  customMaxPrice.value = ''
  void runSearch({ resetPage: true })
}

const removeBrandTag = (brandId: string) => {
  searchParams.brandIds = searchParams.brandIds.filter((id) => id !== brandId)
  void runSearch({ resetPage: true, debounce: true })
}

const removeAttrTag = (tag: AttrTag) => {
  const current = attrSelectionMap.value[tag.attrId] || []
  const nextValues = current.filter((item) => item !== tag.value)
  const nextMap = { ...attrSelectionMap.value }
  if (nextValues.length) {
    nextMap[tag.attrId] = nextValues
  } else {
    delete nextMap[tag.attrId]
  }
  attrSelectionMap.value = nextMap
  syncAttrsFromSelectionMap()
  void runSearch({ resetPage: true, debounce: true })
}

const goPage = (page: number) => {
  if (page < 1 || page > totalPages.value || page === currentPage.value) {
    return
  }
  searchParams.pageNum = page - 1
  void runSearch({ syncRoute: true })
}

const goProductDetail = (product: Product) => {
  window.location.href = `/product/${product.skuId}`
}

watch(
  () => route.query,
  (query) => {
    if (routeSyncing.value) {
      return
    }
    applyQueryToParams(query)
    void runSearch({ syncRoute: false })
  },
)

onMounted(async () => {
  applyQueryToParams(route.query)
  await runSearch({ syncRoute: false })
})

onBeforeUnmount(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
})
</script>

<template>
  <main class="search-page">
    <header class="search-header">
      <div class="container search-header-inner">
        <router-link class="logo" to="/">Smart Mall</router-link>
        <div class="search-input-wrap">
          <input
            v-model="keywordInput"
            type="text"
            maxlength="60"
            placeholder="输入商品关键词进行检索"
            @keyup.enter="submitKeywordSearch"
          />
          <button type="button" @click="submitKeywordSearch">搜索</button>
        </div>
      </div>
    </header>

    <div class="container page-main">
      <section class="result-overview">
        <p>
          共找到 <strong>{{ searchResult.total }}</strong> 件商品
          <span v-if="searchParams.keyword">，关键词：{{ searchParams.keyword }}</span>
        </p>
      </section>

      <section v-if="hasAnySelectedFilter" class="selected-filters">
        <div class="selected-title">已选条件：</div>
        <div class="selected-tags">
          <button
            v-if="searchParams.keyword"
            class="filter-tag"
            type="button"
            @click="clearKeyword"
          >
            关键词：{{ searchParams.keyword }}
            <span>x</span>
          </button>

          <button
            v-if="searchParams.catalogId"
            class="filter-tag"
            type="button"
            @click="clearCatalog"
          >
            分类：{{ selectedCatalogName }}
            <span>x</span>
          </button>

          <button
            v-for="brand in selectedBrandTags"
            :key="`selected-brand-${brand.id}`"
            class="filter-tag"
            type="button"
            @click="removeBrandTag(brand.id)"
          >
            品牌：{{ brand.name }}
            <span>x</span>
          </button>

          <button
            v-for="tag in selectedAttrTags"
            :key="`selected-attr-${tag.attrId}-${tag.value}`"
            class="filter-tag"
            type="button"
            @click="removeAttrTag(tag)"
          >
            {{ tag.attrName }}：{{ tag.value }}
            <span>x</span>
          </button>

          <button
            v-if="searchParams.hasStock === 1"
            class="filter-tag"
            type="button"
            @click="toggleStockOnly"
          >
            仅看有货
            <span>x</span>
          </button>

          <button
            v-if="searchParams.skuPrice"
            class="filter-tag"
            type="button"
            @click="clearPriceFilter"
          >
            价格：{{ searchParams.skuPrice }}
            <span>x</span>
          </button>
        </div>
        <button class="clear-filters" type="button" @click="clearAllFilters">清空筛选</button>
      </section>

      <section class="filter-panel">
        <div class="filter-row">
          <div class="filter-label">分类</div>
          <div class="filter-options">
            <button
              v-for="catalog in searchResult.catalogs"
              :key="catalog.catalogId"
              class="option-btn"
              :class="{ active: searchParams.catalogId === catalog.catalogId }"
              type="button"
              @click="toggleCatalog(catalog)"
            >
              {{ catalog.catalogName }}
            </button>
          </div>
        </div>

        <div class="filter-row">
          <div class="filter-label">品牌</div>
          <div class="filter-options">
            <button
              v-for="brand in searchResult.brands"
              :key="brand.brandId"
              class="option-btn"
              :class="{ active: searchParams.brandIds.includes(brand.brandId) }"
              type="button"
              @click="toggleBrand(brand)"
            >
              {{ brand.brandName }}
            </button>
          </div>
        </div>

        <div v-for="attr in searchResult.attrs" :key="attr.attrId" class="filter-row">
          <div class="filter-label">{{ attr.attrName }}</div>
          <div class="filter-options">
            <button
              v-for="value in attr.attrValue"
              :key="`${attr.attrId}-${value}`"
              class="option-btn"
              :class="{ active: (attrSelectionMap[String(attr.attrId)] || []).includes(value) }"
              type="button"
              @click="toggleAttrValue(attr, value)"
            >
              {{ value }}
            </button>
          </div>
        </div>

        <div class="filter-row compact-row">
          <div class="filter-label">库存</div>
          <div class="filter-options">
            <button
              class="option-btn"
              :class="{ active: searchParams.hasStock === 1 }"
              type="button"
              @click="toggleStockOnly"
            >
              仅看有货
            </button>
          </div>
        </div>

        <div class="filter-row compact-row">
          <div class="filter-label">价格</div>
          <div class="filter-options">
            <button
              v-for="preset in presetPrices"
              :key="preset.value"
              class="option-btn"
              :class="{ active: searchParams.skuPrice === preset.value }"
              type="button"
              @click="applyPresetPrice(preset.value)"
            >
              {{ preset.label }}
            </button>

            <div class="custom-price-wrap">
              <input v-model="customMinPrice" type="text" placeholder="最低价" />
              <span>-</span>
              <input v-model="customMaxPrice" type="text" placeholder="最高价" />
              <button type="button" @click="applyCustomPrice">确定</button>
            </div>
          </div>
        </div>
      </section>

      <section class="sort-bar">
        <button
          v-for="option in sortOptions"
          :key="option.key"
          type="button"
          class="sort-btn"
          :class="{ active: activeSort === option.key }"
          @click="handleSortChange(option.key)"
        >
          {{ option.label }}
        </button>
      </section>

      <section class="list-wrap">
        <div v-if="loadingInitial" class="product-grid skeleton-grid">
          <div v-for="i in 8" :key="`skeleton-${i}`" class="product-card skeleton-card"></div>
        </div>

        <template v-else-if="searchResult.products.length">
          <div class="product-grid" :class="{ 'is-loading': loadingList }">
            <article
              v-for="product in searchResult.products"
              :key="product.skuId"
              class="product-card"
              :class="{ 'is-out': !isProductInStock(product) }"
              @click="goProductDetail(product)"
            >
              <div class="product-image-wrap">
                <img :src="product.skuImg || '/favicon.ico'" :alt="product.skuTitle" />
              </div>

              <h3 class="product-title" v-html="highlightTitle(product.skuTitle)"></h3>

              <p class="product-brand">
                {{ product.brandName || '优选品牌' }}
                <span v-if="product.catalogName"> / {{ product.catalogName }}</span>
              </p>

              <div class="product-meta">
                <span class="price">{{ formatPrice(product.skuPrice) }}</span>
                <span class="sales">销量 {{ product.saleCount || 0 }}</span>
              </div>

              <p v-if="!isProductInStock(product)" class="stock-tag">暂时无货</p>
              <p v-else class="stock-tag in-stock">现货供应</p>
            </article>
          </div>

          <div v-if="loadingList" class="inline-loading">正在更新搜索结果...</div>
        </template>

        <div v-else class="empty-state">
          <p>没有找到符合条件的商品</p>
          <div class="empty-actions">
            <button type="button" @click="clearAllFilters">清空筛选</button>
            <router-link to="/">返回首页</router-link>
          </div>
        </div>
      </section>

      <section v-if="searchResult.products.length && totalPages > 1" class="pagination-wrap">
        <button
          type="button"
          :disabled="currentPage <= 1 || loadingList"
          @click="goPage(currentPage - 1)"
        >
          上一页
        </button>

        <button
          v-for="page in pageNumbers"
          :key="`page-${page}`"
          type="button"
          class="page-btn"
          :class="{ active: page === currentPage, ellipsis: page < 0 }"
          :disabled="page < 0 || loadingList"
          @click="goPage(page)"
        >
          {{ page < 0 ? '...' : page }}
        </button>

        <button
          type="button"
          :disabled="currentPage >= totalPages || loadingList"
          @click="goPage(currentPage + 1)"
        >
          下一页
        </button>
      </section>

      <section v-if="errorMessage" class="error-tip">{{ errorMessage }}</section>
    </div>
  </main>
</template>

<style scoped>
.search-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #f5f5f5 0, #f8f8f8 100%);
  color: #333;
  font-family: 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', sans-serif;
}

.container {
  width: 1200px;
  max-width: calc(100% - 24px);
  margin: 0 auto;
}

.search-header {
  background: #fff;
  border-bottom: 2px solid #e1251b;
  position: sticky;
  top: 0;
  z-index: 40;
}

.search-header-inner {
  min-height: 78px;
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 20px;
  align-items: center;
}

.logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 190px;
  height: 56px;
  border-radius: 10px;
  text-decoration: none;
  font-size: 30px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #ff3d33, #c91623);
}

.search-input-wrap {
  display: flex;
  min-width: 0;
}

.search-input-wrap input {
  flex: 1;
  min-width: 0;
  height: 42px;
  border: 2px solid #e1251b;
  border-right: none;
  border-radius: 6px 0 0 6px;
  padding: 0 12px;
  font-size: 15px;
}

.search-input-wrap input:focus {
  outline: none;
}

.search-input-wrap button {
  width: 100px;
  height: 42px;
  border: none;
  border-radius: 0 6px 6px 0;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(135deg, #e1251b, #c91623);
  cursor: pointer;
}

.page-main {
  padding: 14px 0 24px;
}

.result-overview {
  font-size: 14px;
  color: #666;
}

.result-overview strong {
  color: #e1251b;
  font-size: 18px;
}

.selected-filters {
  margin-top: 12px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: start;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 10px;
  background: #fff;
}

.selected-title {
  color: #666;
  font-size: 13px;
  line-height: 32px;
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-tag {
  height: 30px;
  border: 1px solid #f7c7c7;
  border-radius: 999px;
  background: #fff5f5;
  color: #e1251b;
  padding: 0 12px;
  font-size: 12px;
  cursor: pointer;
}

.filter-tag span {
  margin-left: 6px;
}

.clear-filters {
  height: 30px;
  border: none;
  border-radius: 4px;
  background: #f5f5f5;
  color: #666;
  padding: 0 12px;
  cursor: pointer;
}

.filter-panel {
  margin-top: 12px;
  border: 1px solid #eee;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.filter-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  border-top: 1px solid #f3f3f3;
}

.filter-row:first-child {
  border-top: none;
}

.filter-label {
  padding: 12px;
  background: #f8f8f8;
  color: #666;
  font-size: 13px;
}

.filter-options {
  padding: 10px 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.option-btn {
  min-height: 28px;
  border: 1px solid #eee;
  border-radius: 4px;
  background: #fff;
  color: #555;
  padding: 0 10px;
  font-size: 13px;
  cursor: pointer;
}

.option-btn:hover {
  color: #e1251b;
  border-color: #f2aaaa;
}

.option-btn.active {
  color: #fff;
  border-color: #e1251b;
  background: #e1251b;
}

.compact-row .filter-label {
  display: flex;
  align-items: center;
}

.custom-price-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.custom-price-wrap input {
  width: 92px;
  height: 30px;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0 8px;
  font-size: 13px;
}

.custom-price-wrap button {
  height: 30px;
  border: 1px solid #e1251b;
  border-radius: 4px;
  background: #fff;
  color: #e1251b;
  padding: 0 10px;
  cursor: pointer;
}

.sort-bar {
  margin-top: 12px;
  border: 1px solid #eee;
  border-radius: 8px;
  background: #fff;
  padding: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sort-btn {
  height: 34px;
  border: 1px solid #eee;
  border-radius: 4px;
  background: #fff;
  color: #555;
  padding: 0 14px;
  cursor: pointer;
}

.sort-btn.active {
  color: #fff;
  border-color: #e1251b;
  background: #e1251b;
}

.list-wrap {
  margin-top: 12px;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.product-grid.is-loading {
  opacity: 0.65;
}

.product-card {
  border: 1px solid #efefef;
  border-radius: 10px;
  background: #fff;
  padding: 10px;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.product-card:hover {
  transform: translateY(-2px);
  border-color: #ffd1cf;
  box-shadow: 0 8px 20px rgba(33, 34, 38, 0.08);
}

.product-card.is-out {
  opacity: 0.72;
}

.product-image-wrap {
  aspect-ratio: 1/1;
  border-radius: 8px;
  overflow: hidden;
  background: #f6f6f6;
}

.product-image-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-title {
  margin: 10px 0 0;
  color: #333;
  font-size: 14px;
  line-height: 1.45;
  min-height: 40px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-title :deep(mark) {
  background: #ffe082;
  color: inherit;
  padding: 0 1px;
}

.product-brand {
  margin: 8px 0 0;
  color: #999;
  font-size: 12px;
}

.product-meta {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price {
  color: #e1251b;
  font-size: 20px;
  font-weight: 700;
}

.sales {
  color: #999;
  font-size: 12px;
}

.stock-tag {
  margin-top: 8px;
  display: inline-block;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 12px;
  color: #b54708;
  background: #ffedd5;
}

.stock-tag.in-stock {
  color: #16794f;
  background: #d1fae5;
}

.inline-loading {
  margin-top: 10px;
  padding: 10px;
  border-radius: 6px;
  background: #fff;
  color: #999;
  font-size: 13px;
  text-align: center;
}

.empty-state {
  min-height: 260px;
  border: 1px solid #efefef;
  border-radius: 10px;
  background: #fff;
  display: grid;
  place-items: center;
  color: #777;
}

.empty-actions {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.empty-actions button,
.empty-actions a {
  height: 32px;
  border-radius: 4px;
  border: 1px solid #eee;
  background: #fff;
  color: #666;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  padding: 0 12px;
}

.pagination-wrap {
  margin-top: 14px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
}

.pagination-wrap button {
  min-width: 34px;
  height: 34px;
  border: 1px solid #eee;
  border-radius: 4px;
  background: #fff;
  color: #666;
  padding: 0 10px;
  cursor: pointer;
}

.pagination-wrap button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.page-btn.active {
  color: #fff;
  border-color: #e1251b;
  background: #e1251b;
}

.page-btn.ellipsis {
  cursor: default;
}

.error-tip {
  margin-top: 12px;
  border: 1px solid #ffbdbd;
  border-radius: 8px;
  background: #fff1f1;
  padding: 10px 12px;
  color: #c53030;
  font-size: 13px;
}

.skeleton-grid {
  opacity: 0.75;
}

.skeleton-card {
  height: 290px;
  border-radius: 10px;
  background: linear-gradient(90deg, #f3f3f3 0, #ececec 50%, #f3f3f3 100%);
  background-size: 220% 100%;
  animation: shimmer 1.2s infinite linear;
}

@keyframes shimmer {
  from {
    background-position: 220% 0;
  }
  to {
    background-position: -220% 0;
  }
}

@media (max-width: 1200px) {
  .product-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 992px) {
  .search-header {
    position: static;
  }

  .search-header-inner {
    grid-template-columns: 1fr;
    padding: 12px 0;
    gap: 12px;
  }

  .logo {
    width: 180px;
  }

  .selected-filters {
    grid-template-columns: 1fr;
  }

  .filter-row {
    grid-template-columns: 1fr;
  }

  .filter-label {
    border-bottom: 1px solid #f3f3f3;
  }

  .product-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .custom-price-wrap {
    flex-wrap: wrap;
  }
}

@media (max-width: 520px) {
  .search-input-wrap {
    flex-direction: column;
    gap: 8px;
  }

  .search-input-wrap input {
    border-right: 2px solid #e1251b;
    border-radius: 6px;
  }

  .search-input-wrap button {
    width: 100%;
    border-radius: 6px;
  }

  .product-grid {
    grid-template-columns: 1fr;
  }
}
</style>
