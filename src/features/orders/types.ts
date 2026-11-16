import type { PayStatus, ShippingInfo } from '../../lib/payment'

export interface OrderItem {
  id: string
  /** id sản phẩm loại "Áo" trong gk_products (dữ liệu cũ: "thun" / "polo") */
  productId: string
  /** Tên áo lúc đặt (giữ nguyên dù sau này đổi / xoá sản phẩm) */
  name: string
  color: string
  size: string
  qty: number
  /** Đơn giá 1 áo (mặc định theo loại áo, sửa được); null = chưa có giá */
  price: number | null
}

/** Phần nội dung đơn áo mà trang sửa tự lưu (các field cùng tên trong document gk_orders/{id}) */
export interface OrderContent {
  recipient: { name: string; phone: string; address: string }
  items: OrderItem[]
  /** Chữ in lên tag (ảnh tag ở subcollection images, kind = "tag") */
  tagContent: string
  /** Chữ thêu (ảnh thêu ở subcollection images, kind = "embroidery") */
  embroideryContent: string
  /** null = không tính phí vận chuyển, 0 = miễn phí */
  ship: number | null
  note: string
}

/** Chưa nhận tiền → Đã nhận tiền (paidPercent %) → Đã mang ra bưu cục — xem src/lib/payment.ts */
export type OrderStatus = PayStatus

export interface OrderTotals {
  qty: number
  goods: number
  grand: number
}

/** Document gk_orders/{id} — xem docs/firestore.md */
export interface OrderDoc extends OrderContent {
  id: string
  status: OrderStatus
  /** % tiền đã nhận (khi đã nhận tiền); null = chưa nhận */
  paidPercent: number | null
  /** Thời điểm chuyển sang từng trạng thái */
  statusAt: Partial<Record<OrderStatus, Date | null>>
  shipping: ShippingInfo
  totals: OrderTotals
  createdAt: Date | null
  updatedAt: Date | null
  createdBy: string | null
  updatedBy: string | null
}
