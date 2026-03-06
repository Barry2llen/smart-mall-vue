import request from '@/utils/request'

export interface RObject<T = unknown> {
  code?: string | number
  msg?: string
  data?: T
}

export interface FlashSaleSessionQuery {
  withExpired?: boolean
  withProducts?: boolean
  pageNum?: number
  pageSize?: number
}

export interface SessionRelatedSkuInfoVO {
  id?: string
  promotionId?: string
  spuId?: string
  skuId?: string
  seckillPrice?: number
  seckillCount?: number
  seckillLimit?: number
  seckillSort?: number
  catalogId?: string
  skuName?: string
  skuDesc?: string
  skuDefaultImg?: string
  skuTitle?: string
  skuSubtitle?: string
  saleCount?: number
}

export interface SessionVO {
  id?: string
  name?: string
  startTime?: string
  endTime?: string
  createTime?: string
  skuInfos?: SessionRelatedSkuInfoVO[]
}

export interface FlashSaleSession {
  id?: string
  name?: string
  startTime?: string
  endTime?: string
  createTime?: string
}

const FLASH_SALE_API = '/flash-sale'

const normalizeQuery = (params: FlashSaleSessionQuery = {}) => {
  const query: FlashSaleSessionQuery = {}
  if (typeof params.withExpired === 'boolean') {
    query.withExpired = params.withExpired
  }
  if (typeof params.withProducts === 'boolean') {
    query.withProducts = params.withProducts
  }
  if (typeof params.pageNum === 'number' && params.pageNum >= 1) {
    query.pageNum = params.pageNum
  }
  if (typeof params.pageSize === 'number' && params.pageSize >= 1 && params.pageSize <= 100) {
    query.pageSize = params.pageSize
  }
  return query
}

export function getFlashSaleSessions(params: FlashSaleSessionQuery = {}) {
  return request.get<RObject<SessionVO[]>, RObject<SessionVO[]>>(
    `${FLASH_SALE_API}/public/flash-sale/sessions`,
    {
      params: normalizeQuery(params),
    },
  )
}

export function isSkuInFlashSale(skuId: string) {
  return request.get<RObject<boolean>, RObject<boolean>>(
    `${FLASH_SALE_API}/public/flash-sale/sku/${skuId}/in-flash-sale`,
  )
}

export function getFlashSaleSessionsBySkuId(skuId: string) {
  return request.get<RObject<FlashSaleSession[]>, RObject<FlashSaleSession[]>>(
    `${FLASH_SALE_API}/public/flash-sale/sku/${skuId}/sessions`,
  )
}

export function getFlashSaleSessionById(sessionId: string, withProducts = false) {
  return request.get<RObject<SessionVO>, RObject<SessionVO>>(
    `${FLASH_SALE_API}/public/flash-sale/session/${sessionId}`,
    {
      params: {
        withProducts,
      },
    },
  )
}
