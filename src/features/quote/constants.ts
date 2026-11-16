import type { PaymentNotes } from '../../components/PaymentStatus'
import type { ProductDoc } from '../products/types'
import { FALLBACK_PRODUCTS } from '../products/catalog'
import type { FontKey, Product } from './types'

// Bảng giá theo số lượng, màu tag, kích thước nằm ở Quản lý sản phẩm (gk_products, loại "Mác áo"); báo giá chụp lại lúc tạo.

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

/** Sản phẩm mác áo đang bán → bảng giá, màu, kích thước chụp vào báo giá */
export const tagProductsOf = (catalog: ProductDoc[] | null): Product[] =>
  (catalog ?? FALLBACK_PRODUCTS)
    .filter((p) => p.type === 'tag' && p.active)
    .map((p) => ({ id: p.id, name: p.name, tiers: p.tiers, printKind: p.printKind, colors: p.colors, sizes: p.sizes }))

/** Bảng giá mặc định khi chưa có sản phẩm trên Firebase */
export const DEFAULT_PRODUCTS: Product[] = tagProductsOf(null)

export const DEFAULT_FONT: FontKey = 'inter'

/** Nhắc trong các hộp xác nhận trạng thái của báo giá (khoá khi đã nhận tiền) */
export const QUOTE_PAYMENT_NOTES: PaymentNotes = {
  paid: 'Sau khi xác nhận, báo giá bị khoá: không sửa nội dung, không xoá được. Bấm nhầm thì chuyển về “Chưa nhận tiền” để mở khoá.',
  backToUnpaid: 'Báo giá sẽ mở khoá: sửa và xoá được lại.',
}

/** productId của dòng "Sản phẩm khác…" (tự nhập tên và giá) */
export const CUSTOM = 'custom'
/** Cạnh dài nhất của ảnh nội dung in sau khi thu nhỏ (px) */
export const MAX_PRINT_IMAGE = 1200
