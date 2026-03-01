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
  return request
    .get<ROrderConfirm, ROrderConfirm>('/order/public/confirm')
    .then((res) => res.data)
}

export interface RObject {
  code: string
  msg: string
  data?: unknown
}

export function submitOrder(data: OrderSubmit) {
  return request.post<RObject, RObject>('/order/public/submit', data)
}
