export type ProductType = 'tag' | 'shirt'

/** Một bậc giá: đặt từ `min` chiếc trở lên (tới bậc kế) thì đơn giá `price`; null = thương lượng */
export interface PriceTier {
  min: number
  price: number | null
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
  /** Áo: giá 1 áo */
  price: number | null
  /** Áo: các màu */
  colors: string[]
  /** Áo: các size */
  sizes: string[]
  /** Áo: mô tả chất liệu / form */
  spec: string
  /** Thứ tự hiển thị */
  sortOrder: number
}

export interface ProductDoc extends ProductContent {
  id: string
  createdAt: Date | null
  updatedAt: Date | null
  createdBy: string | null
  updatedBy: string | null
}
