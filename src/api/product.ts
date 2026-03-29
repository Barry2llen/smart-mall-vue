import request from '@/utils/request'

export interface RObject<T = unknown> {
  code?: string | number
  msg?: string
  data?: T
}

export interface ProductSearchParam {
  keyword?: string
  catalogId?: string
  sort?: string[]
  hasStock?: 0 | 1
  skuPrice?: string
  brandIds?: string[]
  attrs?: string[]
  pageNum?: number
  pageSize?: number
}

export interface ProductAttrValue {
  attrId?: string
  attrName?: string
  attrValue?: string
}

export interface Product {
  spuId: string
  defaultSkuId?: string
  minPrice: number
  maxPrice?: number
  defaultImage?: string
  spuName: string
  saleCount?: number
  hasStock?: boolean | number
  hotScore?: number
  brandId?: string
  catalogId?: string
  brandName?: string
  brandImg?: string
  catalogName?: string
}

interface LegacyProduct {
  skuId?: string
  spuId?: string
  defaultSkuId?: string
  spuName?: string
  skuTitle?: string
  minPrice?: number
  maxPrice?: number
  skuPrice?: number
  defaultImage?: string
  skuImg?: string
  saleCount?: number
  hasStock?: boolean | number
  hotScore?: number
  brandId?: string
  catalogId?: string
  brandName?: string
  brandImg?: string
  catalogName?: string
  attrs?: ProductAttrValue[]
}

type RawSearchProduct = Partial<Product> & LegacyProduct

export interface RelatedBrand {
  brandId: string
  brandName: string
  logo?: string
}

export interface RelatedCatalog {
  catalogId: string
  catalogName: string
}

export interface RelatedAttr {
  attrId: string
  attrName: string
  attrValue: string[]
}

export interface ProductSearchResult {
  products: Product[]
  total: number
  pages: number
  pageNum: number
  brands: RelatedBrand[]
  attrs: RelatedAttr[]
  catalogs: RelatedCatalog[]
}

const normalizeProduct = (item: RawSearchProduct): Product => {
  const spuId = String(item.spuId || item.skuId || '')
  const defaultSkuId = item.defaultSkuId || item.skuId
  const minPrice = Number(item.minPrice ?? item.skuPrice ?? 0)
  const maxPrice = Number(item.maxPrice ?? item.skuPrice ?? minPrice)

  return {
    spuId,
    defaultSkuId: defaultSkuId ? String(defaultSkuId) : undefined,
    spuName: item.spuName || item.skuTitle || '',
    defaultImage: item.defaultImage || item.skuImg,
    minPrice,
    maxPrice,
    saleCount: item.saleCount,
    hasStock: item.hasStock,
    hotScore: item.hotScore,
    brandId: item.brandId,
    catalogId: item.catalogId,
    brandName: item.brandName,
    brandImg: item.brandImg,
    catalogName: item.catalogName,
  }
}

const normalizeSearchResult = (result?: RObject<ProductSearchResult>): RObject<ProductSearchResult> => {
  if (!result?.data) {
    return result || {}
  }

  return {
    ...result,
    data: {
      ...result.data,
      products: Array.isArray(result.data.products) ? result.data.products.map((item) => normalizeProduct(item)) : [],
      total: Number(result.data.total || 0),
      pages: Number(result.data.pages || 0),
      pageNum: Number(result.data.pageNum || 0),
      brands: Array.isArray(result.data.brands) ? result.data.brands : [],
      attrs: Array.isArray(result.data.attrs) ? result.data.attrs : [],
      catalogs: Array.isArray(result.data.catalogs) ? result.data.catalogs : [],
    },
  }
}

export interface CategoryVO {
  catId?: string
  name?: string
  parentCid?: string
  catLevel?: number
  showStatus?: number
  sort?: number
  icon?: string
  productUnit?: string
  productCount?: number
  children?: CategoryVO[]
}

export interface SkuInfoVO {
  skuId?: string
  spuId?: string
  catalogId?: string
  skuName?: string
  skuDesc?: string
  skuDefaultImg?: string
  skuTitle?: string
  skuSubtitle?: string
  price?: number
  saleCount?: number
}

export interface SkuImages {
  id?: string
  skuId?: string
  imgUrl?: string
  imgSort?: number
  defaultImg?: number
}

export interface SkuItemSaleAttrVO {
  attrId?: string
  attrName?: string
  attrValues?: string
}

export interface SpuInfoDesc {
  spuId?: string
  decript?: string
}

export interface SpuBaseAttrVO {
  attrId?: string
  attrName?: string
  attrValue?: string
}

export interface SpuItemAttrGroupVO {
  groupName?: string
  attrs?: SpuBaseAttrVO[]
}

export interface SkuItemVO {
  skuInfo?: SkuInfoVO
  images?: SkuImages[]
  saleAttr?: SkuItemSaleAttrVO[]
  desp?: SpuInfoDesc
  groupAttrs?: SpuItemAttrGroupVO[]
}

const SEARCH_API = '/search'
const PRODUCT_API = '/product'

const cleanArray = <T>(list?: T[]) => {
  if (!Array.isArray(list)) {
    return undefined
  }
  const filtered = list.filter((item) => {
    if (item === null || item === undefined) {
      return false
    }
    if (typeof item === 'string') {
      return item.trim().length > 0
    }
    return true
  })
  return filtered.length ? filtered : undefined
}

const normalizeKeyword = (keyword?: string) => {
  if (typeof keyword !== 'string') {
    return undefined
  }
  const value = keyword.trim()
  return value || undefined
}

export const buildProductSearchPayload = (params: ProductSearchParam = {}): ProductSearchParam => {
  const payload: ProductSearchParam = {}
  const keyword = normalizeKeyword(params.keyword)
  if (keyword) {
    payload.keyword = keyword
  }

  if (typeof params.catalogId === 'string' && params.catalogId.trim()) {
    payload.catalogId = params.catalogId
  }

  if (params.hasStock === 0 || params.hasStock === 1) {
    payload.hasStock = params.hasStock
  }

  if (typeof params.skuPrice === 'string' && params.skuPrice.trim()) {
    payload.skuPrice = params.skuPrice.trim()
  }

  const brandIds = cleanArray(params.brandIds)
  if (brandIds) {
    payload.brandIds = brandIds
  }

  const attrs = cleanArray(params.attrs)
  if (attrs) {
    payload.attrs = attrs
  }

  const sort = cleanArray(params.sort)
  if (sort) {
    payload.sort = sort
  }

  if (typeof params.pageNum === 'number' && params.pageNum >= 0) {
    payload.pageNum = params.pageNum
  }

  if (typeof params.pageSize === 'number' && params.pageSize > 0) {
    payload.pageSize = params.pageSize
  }

  return payload
}

export async function searchProducts(params: ProductSearchParam = {}) {
  const result = await request.post<RObject<ProductSearchResult>, RObject<ProductSearchResult>>(
    `${SEARCH_API}/public/product/search`,
    buildProductSearchPayload(params),
  )
  return normalizeSearchResult(result)
}

export function getCategoryTree() {
  return request.get<RObject<CategoryVO[]>, RObject<CategoryVO[]>>(
    `${PRODUCT_API}/public/product/category/list`,
  )
}

export function getSkuItem(skuId: string) {
  return request.get<RObject<SkuItemVO>, RObject<SkuItemVO>>(`${PRODUCT_API}/public/product/item/${skuId}`)
}

export function getSpuSkuAttrsMapping(spuId: string) {
  return request.get<RObject<Record<string, string>>, RObject<Record<string, string>>>(
    `${PRODUCT_API}/public/product/spu/${spuId}/sku-attrs-mapping`,
  )
}
