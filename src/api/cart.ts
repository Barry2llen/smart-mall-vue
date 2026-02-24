import request from '@/utils/request'

export interface CartItemVO {
  skuId: number
  spuId: number
  selected: boolean
  title: string
  image: string
  skuAttr: string[]
  price: number
  count: number
  stock?: number
  totalPrice: number
}

export interface Cart {
  items: CartItemVO[]
  countNumber: number
  countType: number
  totalAmount: number
  reduce: number
}

export interface RCart {
  code: string
  msg: string
  data: Cart
}

export function getCart() {
  return request.get<RCart, RCart>('/cart/public').then((res) => res.data)
}

export function checkCartItem(skuId: number) {
  return request.put(`/cart/public/${skuId}/check`)
}

export function uncheckCartItem(skuId: number) {
  return request.put(`/cart/public/${skuId}/uncheck`)
}

export function deleteCartItem(skuId: number) {
  return request.delete(`/cart/public/${skuId}`)
}

export function updateCartItemCount(skuId: number, count: number) {
  return request.put(`/cart/public/${skuId}/count`, null, {
    params: { count },
  })
}
