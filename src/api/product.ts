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
  skuId: string
  spuId?: string
  skuTitle: string
  skuPrice: number
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

export interface CategoryVO {
  catId?: number
  name?: string
  parentCid?: number
  catLevel?: number
  showStatus?: number
  sort?: number
  icon?: string
  productUnit?: string
  productCount?: number
  children?: CategoryVO[]
}

const PRODUCT_API = '/search'

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

export function searchProducts(params: ProductSearchParam = {}) {
  return request.post<RObject<ProductSearchResult>, RObject<ProductSearchResult>>(
    `${PRODUCT_API}/public/product/search`,
    buildProductSearchPayload(params),
  )
}

export function getCategoryTree() {
  return request.get<RObject<CategoryVO[]>, RObject<CategoryVO[]>>(
    `${PRODUCT_API}/public/product/category/list`,
  )
}
