import request from '@/utils/request'

export interface MemberReceiveAddress {
  id: number
  memberId: number
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

export interface OrderItemVO {
  skuId: number
  spuId: number
  title: string
  image: string
  skuAttr: string[]
  price: number
  count: number
  totalPrice: number
}

export interface OrderConfirm {
  addresses: MemberReceiveAddress[]
  items: OrderItemVO[]
  points: number
  total: number
  payTotal: number
  token?: string
}

export interface OrderSubmit {
  addrId: number
  payment: string
  token: string
  price: number
  notes?: string
}

export interface ROrderConfirm {
  code: string
  msg: string
  data: OrderConfirm
}

export function getOrderConfirm() {
  return request.get<ROrderConfirm, ROrderConfirm>('/order/public/confirm').then((res) => res.data)
}

export interface RObject {
  code: string
  msg: string
  data?: unknown
}

export function submitOrder(data: OrderSubmit) {
  return request.post<RObject, RObject>('/order/public/submit', data)
}

export interface OrderListSkuItem {
  skuId: number
  categoryId?: number
  skuName: string
  skuPic: string
  skuPrice: number
  skuQuantity: number
  skuAttrsVals: string
  promotionAmount?: number
  couponAmount?: number
  integrationAmount?: number
  realAmount?: number
  giftIntegration?: number
  giftGrowth?: number
}

export interface OrderListSpuItem {
  spuId: number
  spuName: string
  spuPic: string
  spuBrand: string
  spuItems: OrderListSkuItem[]
}

export interface Order {
  id: number
  memberId?: number
  orderSn: string
  couponId?: number
  memberUsername?: string
  totalAmount?: number
  payAmount?: number
  freightAmount?: number
  promotionAmount?: number
  integrationAmount?: number
  couponAmount?: number
  discountAmount?: number
  payType?: string
  sourceType?: string
  status: string
  deliveryCompany?: string
  deliverySn?: string
  autoConfirmDay?: number
  integration?: number
  growth?: number
  billType?: string
  billHeader?: string
  billContent?: string
  billReceiverPhone?: string
  billReceiverEmail?: string
  createTime: string
  receiverName?: string
  receiverPhone?: string
  receiverPostCode?: string
  receiverProvince?: string
  receiverCity?: string
  receiverRegion?: string
  receiverDetailAddress?: string
  note?: string
  confirmStatus?: number
  deleteStatus?: number
  useIntegration?: number
  paymentTime?: string
  deliveryTime?: string
  receiveTime?: string
  commentTime?: string
  modifyTime?: string
}

export interface OrderWithItems {
  order: Order
  items: OrderListSpuItem[]
}

export interface RListOrderWithItems {
  code: string
  msg: string
  data: OrderWithItems[]
}

export interface ROrderWithItems {
  code: string
  msg: string
  data: OrderWithItems
}

export interface OrderListQuery {
  pageNum: number
  pageSize: number
  status?: number
  keyword?: string
}

export function getOrderList(params: OrderListQuery) {
  return request
    .get<RListOrderWithItems, RListOrderWithItems>('/order/public/orders', {
      params,
    })
    .then((res) => res.data)
}

export function getOrderBySn(sn: string) {
  return request
    .get<ROrderWithItems, ROrderWithItems>(`/order/public/orders/${sn}`, {
      params: { includeItems: true },
    })
    .then((res) => res.data)
}
