import type { ProductDoc } from '../products/types'
import { FALLBACK_PRODUCTS } from '../products/catalog'
import type { FontKey, Product } from './types'

// Bảng giá theo số lượng nằm ở Quản lý sản phẩm (gk_products, loại "Mác áo"); báo giá chụp lại lúc tạo.

export const COLORS = [
  { name: 'Trắng', swatch: '#FFFFFF' },
  { name: 'Be', swatch: '#E8D9BF' },
] as const

export const SIZES = ['4 × 6 cm', '3 × 5 cm', '1.5 × 6 cm'] as const

export const FONTS: Record<FontKey, { label: string; heading: string; body: string }> = {
  inter: { label: 'Inter', heading: '"Inter"', body: '"Inter"' },
  // Outfit không có chữ tiếng Việt nên các chữ có dấu lấy từ Lexend (cùng phong cách)
  outfit: { label: 'Outfit', heading: '"Outfit", "Lexend"', body: '"Outfit", "Lexend"' },
  classic: { label: 'Thanh lịch – Playfair Display + Nunito', heading: '"Playfair Display"', body: '"Nunito"' },
  soft: { label: 'Mềm mại – Quicksand', heading: '"Quicksand"', body: '"Quicksand"' },
  modern: { label: 'Hiện đại – Montserrat', heading: '"Montserrat"', body: '"Montserrat"' },
  handmade: { label: 'Viết tay – Mali + Nunito', heading: '"Mali"', body: '"Nunito"' },
  original: { label: 'Gọn gàng – Be Vietnam Pro (font cũ)', heading: '"Be Vietnam Pro"', body: '"Be Vietnam Pro"' },
}

/** Sản phẩm mác áo đang bán → bảng giá chụp vào báo giá */
export const tagProductsOf = (catalog: ProductDoc[] | null): Product[] =>
  (catalog ?? FALLBACK_PRODUCTS)
    .filter((p) => p.type === 'tag' && p.active)
    .map((p) => ({ id: p.id, name: p.name, tiers: p.tiers }))

/** Bảng giá mặc định khi chưa có sản phẩm trên Firebase */
export const DEFAULT_PRODUCTS: Product[] = tagProductsOf(null)

export const DEFAULT_FONT: FontKey = 'inter'

/** productId của dòng "Sản phẩm khác…" (tự nhập tên và giá) */
export const CUSTOM = 'custom'
/** Cạnh dài nhất của ảnh nội dung in sau khi thu nhỏ (px) */
export const MAX_PRINT_IMAGE = 1200
