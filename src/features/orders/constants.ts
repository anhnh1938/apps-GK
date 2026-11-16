import { FALLBACK_PRODUCTS } from '../products/catalog'
import type { PaymentNotes } from '../../components/PaymentStatus'
import type { ProductDoc } from '../products/types'

// Loại áo / giá / màu / size cấu hình ở Quản lý sản phẩm (gk_products, loại "Áo").

/** Sản phẩm áo đang bán (chưa có sản phẩm trên Firebase → dùng catalog mặc định) */
export const shirtProductsOf = (catalog: ProductDoc[] | null) =>
  (catalog ?? FALLBACK_PRODUCTS).filter((p) => p.type === 'shirt' && p.active)

/** Nhắc trong các hộp xác nhận trạng thái của đơn áo (khoá khi đã mang ra bưu cục) */
export const ORDER_PAYMENT_NOTES: PaymentNotes = {
  shipped:
    'Sau khi xác nhận, đơn bị khoá: không sửa, không xoá được. Nhớ in mã vận chuyển dán lên gói trước khi gửi. Bấm nhầm thì chuyển về “Đã nhận tiền” để mở khoá.',
  backToPaid: 'Đơn sẽ mở khoá: sửa và xoá được lại.',
}

/** Cạnh dài nhất của ảnh tag / thêu sau khi thu nhỏ (px) */
export const MAX_ORDER_IMAGE = 1600
