import { FALLBACK_PRODUCTS } from '../products/catalog'
import type { ProductDoc } from '../products/types'

// Loại áo / giá / màu / size cấu hình ở Quản lý sản phẩm (gk_products, loại "Áo").

/** Sản phẩm áo đang bán (chưa có sản phẩm trên Firebase → dùng catalog mặc định) */
export const shirtProductsOf = (catalog: ProductDoc[] | null) =>
  (catalog ?? FALLBACK_PRODUCTS).filter((p) => p.type === 'shirt' && p.active)

/** Màu chấm tròn cạnh tên màu áo (màu lạ thì xám) */
export const SWATCH: Record<string, string> = {
  'Xanh than': '#1f2a44',
  Trắng: '#ffffff',
  Đen: '#1c1917',
  Be: '#e8d9bf',
  Xám: '#9ca3af',
  Nâu: '#7c4a2d',
}

/** Cạnh dài nhất của ảnh tag / thêu sau khi thu nhỏ (px) */
export const MAX_ORDER_IMAGE = 1600
