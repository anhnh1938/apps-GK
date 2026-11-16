import type { PayStatus, ShippingInfo } from '../../lib/payment'
import type { PriceTier, PrintKind, ProductColor } from '../products/types'

export type FontKey = 'inter' | 'outfit' | 'classic' | 'soft' | 'modern' | 'handmade' | 'original'

/** Sản phẩm mác áo chụp từ Quản lý sản phẩm lúc tạo báo giá (đổi sản phẩm sau này không làm sai báo giá cũ) */
export interface Product {
  id: string
  name: string
  /** Bảng giá theo số lượng */
  tiers: PriceTier[]
  /** Số lượng tự tính theo số câu (`text`) hay số ảnh (`image`) của "Nội dung in" */
  printKind: PrintKind
  /** Màu tag để chọn */
  colors: ProductColor[]
  /** Kích thước tag để chọn */
  sizes: string[]
}

export interface QuoteItem {
  id: string
  /** id trong `products`, hoặc CUSTOM cho sản phẩm tự nhập */
  productId: string
  /** Tên sản phẩm — chỉ dùng cho CUSTOM */
  name: string
  color: string
  size: string
  qty: number
  /** Đơn giá nhập tay (khi `manual`) hoặc của sản phẩm CUSTOM */
  price: number | null
  /** true = dùng `price` nhập tay thay cho giá tự tính theo bảng */
  manual: boolean
}

export interface PrintImage {
  id: string
  src: string
}

/** Phần nội dung báo giá mà trang sửa tự lưu (các field cùng tên trong document gk_quotes/{id}) */
export interface QuoteContent {
  customer: { name: string; phone: string; address: string }
  /** YYYY-MM-DD */
  date: string
  font: FontKey
  title: string
  subtitle: string
  showPriceTables: boolean
  showPayment: boolean
  /** Bảng giá chụp lại theo từng báo giá (đổi giá sau này không ảnh hưởng báo giá cũ) */
  products: Product[]
  items: QuoteItem[]
  /** null = không hiện dòng phí vận chuyển, 0 = "Miễn phí" */
  ship: number | null
  /** Danh sách câu cần in — cũng là nguồn duy nhất của file mẫu câu (parseList) */
  printContent: string
  notes: string
}

/** Dữ liệu cho form + bản xem trước: nội dung + ảnh nội dung in (lưu ở subcollection images) */
export interface QuoteState extends QuoteContent {
  printImages: PrintImage[]
}

/** Chưa nhận tiền → Đã nhận tiền (paidPercent %) → Đã mang ra bưu cục — xem src/lib/payment.ts */
export type QuoteStatus = PayStatus

export interface Totals {
  qty: number
  goods: number
  grand: number
}

/** Document gk_quotes/{id} — xem docs/firestore.md */
export interface QuoteDoc extends QuoteContent {
  id: string
  /** Khác "unpaid" = đã nhận tiền → báo giá bị khoá (không sửa nội dung, không xoá) */
  status: QuoteStatus
  /** % tiền đã nhận (khi đã nhận tiền); null = chưa nhận */
  paidPercent: number | null
  /** Thời điểm chuyển sang từng trạng thái */
  statusAt: Partial<Record<QuoteStatus, Date | null>>
  shipping: ShippingInfo
  /** Tính sẵn khi lưu, để danh sách không phải tính lại */
  totals: Totals
  createdAt: Date | null
  updatedAt: Date | null
  createdBy: string | null
  updatedBy: string | null
}
