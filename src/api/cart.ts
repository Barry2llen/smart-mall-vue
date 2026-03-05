import request from '@/utils/request'

export interface CartItemVO {
  skuId: string
  spuId: string
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

export function checkCartItem(skuId: string) {
  return request.put(`/cart/public/${skuId}/check`)
}

export function uncheckCartItem(skuId: string) {
  return request.put(`/cart/public/${skuId}/uncheck`)
}

export function deleteCartItem(skuId: string) {
  return request.delete(`/cart/public/${skuId}`)
}

export function updateCartItemCount(skuId: string, count: number) {
  return request.put(`/cart/public/${skuId}/count`, null, {
    params: { count },
  })
}
