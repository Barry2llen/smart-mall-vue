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
  totalPrice: number
}

export interface Cart {
  items: CartItemVO[]
  countNumber: number
  countType: number
  totalAmount: number
  reduce: number
}

export function getCart() {
  return request.get<Cart, Cart>('/cart')
}

export function checkCartItem(skuId: number) {
  return request.put(`/cart/${skuId}/check`)
}

export function uncheckCartItem(skuId: number) {
  return request.put(`/cart/${skuId}/uncheck`)
}

export function deleteCartItem(skuId: number) {
  return request.delete(`/cart/${skuId}`)
}

export function updateCartItemCount(skuId: number, count: number) {
  return request.put(`/cart/${skuId}/count`, null, {
    params: { count },
  })
}
