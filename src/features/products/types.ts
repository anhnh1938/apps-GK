export type ProductType = 'tag' | 'shirt'

/** Mác áo: số lượng trên báo giá tự tính theo "Nội dung in" — `text` = số câu, `image` = số ảnh */
export type PrintKind = 'text' | 'image'

/** Một bậc giá: đặt từ `min` chiếc trở lên (tới bậc kế) thì đơn giá `price`; null = thương lượng */
export interface PriceTier {
  min: number
  price: number | null
}

/** Một màu: tên hiển thị + mã màu (chấm màu cạnh tên) */
export interface ProductColor {
  name: string
  hex: string
}

/** Phần nội dung sản phẩm (các field cùng tên trong document gk_products/{id}) */
export interface ProductContent {
  type: ProductType
  name: string
  /** false = ẩn, không hiện khi tạo báo giá / đơn mới */
  active: boolean
  note: string
  /** Mác áo: bảng giá theo số lượng đặt, sắp theo `min` tăng dần, bậc đầu min = 1 */
  tiers: PriceTier[]
  /** Mác áo: số lượng tính theo số câu (tag in chữ) hay số ảnh (tag in hình) của "Nội dung in" */
  printKind: PrintKind
  /** Áo: giá 1 áo */
  price: number | null
  /** Các màu (mác áo: màu tag; áo: màu áo) */
  colors: ProductColor[]
  /** Các size (mác áo: kích thước tag, VD "4 × 6 cm"; áo: S / M / L…) */
  sizes: string[]
  /** Áo: mô tả chất liệu / form */
  spec: string
  /** Thứ tự hiển thị (không sửa trên form; sản phẩm mới xếp sau) */
  sortOrder: number
}

export interface ProductDoc extends ProductContent {
  id: string
  createdAt: Date | null
  updatedAt: Date | null
  createdBy: string | null
  updatedBy: string | null
}
