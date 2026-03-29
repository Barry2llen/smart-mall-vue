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
  randomCode?: string
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

export interface FlashSaleOrderItem {
  skuId: string
  spuId: string
  title: string
  image: string
  skuAttr: string[]
  price: number
  count: number
  totalPrice: number
}

export interface FlashSaleMemberReceiveAddress {
  id: string
  memberId: string
  name: string
  phone: string
  postCode: string
  province: string
  city: string
  region: string
  detailAddress: string
  areacode: string
  defaultStatus: number
}

export interface FlashSaleOrderConfirm {
  addresses: FlashSaleMemberReceiveAddress[]
  item: FlashSaleOrderItem | null
  points: number
  total: number
  payTotal: number
}

export interface FlashSaleKillPayload {
  skuId: string
  sessionId: string
  randomCode: string
  num: number
  addressId?: string
  note?: string
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

export function getFlashSaleOrderConfirm(
  userId: string,
  sessionId: string,
  skuId: string,
  num: number,
) {
  return request.get<RObject<FlashSaleOrderConfirm>, RObject<FlashSaleOrderConfirm>>(
    `${FLASH_SALE_API}/public/flash-sale`,
    {
      params: {
        userId,
        sessionId,
        skuId,
        num,
      },
    },
  )
}

export function submitFlashSaleOrder(userId: string, payload: FlashSaleKillPayload) {
  return request.post<RObject, RObject>(`${FLASH_SALE_API}/public/flash-sale/kill`, payload, {
    params: {
      userId,
      skuId: payload.skuId,
      randomCode: payload.randomCode,
      sessionId: payload.sessionId,
      num: payload.num,
    },
  })
}
