export interface SearchPriceRangeLike {
  minPrice?: number | string | null
  maxPrice?: number | string | null
}

export const formatPrice = (price?: number | string | null) => `¥${Number(price || 0).toFixed(2)}`

export const formatSearchProductPrice = (product: SearchPriceRangeLike) => {
  const minPrice = Number(product.minPrice || 0)
  const maxPrice = Number(product.maxPrice ?? minPrice)
  if (maxPrice > minPrice) {
    return `${formatPrice(minPrice)}起`
  }
  return formatPrice(minPrice)
}
