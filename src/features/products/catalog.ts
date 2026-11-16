import { fmtMoney } from '../../lib/format'
import type { PriceTier, ProductContent, ProductDoc } from './types'

// Sản phẩm mặc định (nút "Tạo sản phẩm mặc định") — giá lấy từ bản báo giá gốc và "Shop facts" của D:\projects\ảnh GK.
// ID cố định "chu" / "hinh" / "thun" / "polo" trùng với dữ liệu báo giá / đơn áo cũ, nên dữ liệu cũ vẫn khớp.
const tiers = (prices: number[]): PriceTier[] => [1, 10, 20, 50, 100].map((min, i) => ({ min, price: prices[i] }))

export const DEFAULT_CATALOG: (ProductContent & { id: string })[] = [
  {
    id: 'chu',
    type: 'tag',
    name: 'Tag in chữ',
    active: true,
    note: '',
    tiers: tiers([28000, 25000, 22000, 20000, 18000]),
    price: null,
    colors: [],
    sizes: [],
    spec: '',
    sortOrder: 1,
  },
  {
    id: 'hinh',
    type: 'tag',
    name: 'Tag in hình',
    active: true,
    note: '',
    tiers: tiers([33000, 30000, 27000, 25000, 23000]),
    price: null,
    colors: [],
    sizes: [],
    spec: '',
    sortOrder: 2,
  },
  {
    id: 'thun',
    type: 'shirt',
    name: 'Áo thun',
    active: true,
    note: 'Giá đã gồm tối đa 2 tag',
    tiers: [],
    price: 229000,
    colors: ['Xanh than', 'Trắng', 'Đen'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    spec: 'Cotton 100% · 250 gsm · Regular · Unisex, cổ tròn',
    sortOrder: 3,
  },
  {
    id: 'polo',
    type: 'shirt',
    name: 'Áo polo',
    active: true,
    note: 'Giá đã gồm tối đa 2 tag',
    tiers: [],
    price: 269000,
    colors: ['Đen', 'Trắng', 'Xanh than'],
    sizes: ['M', 'L', 'XL', '2XL'],
    spec: 'Spandex Polyester Lacoste · 250 gsm · Regular fit, cổ bẻ',
    sortOrder: 4,
  },
]

/** Catalog trong bộ nhớ khi Firestore chưa có sản phẩm nào (app vẫn chạy được trước khi tạo sản phẩm) */
export const FALLBACK_PRODUCTS: ProductDoc[] = DEFAULT_CATALOG.map((p) => ({
  ...p,
  createdAt: null,
  updatedAt: null,
  createdBy: null,
  updatedBy: null,
}))

/** Sắp bậc theo số lượng tăng dần, bỏ bậc trùng */
export const sortTiers = (list: PriceTier[]) =>
  [...list].sort((a, b) => a.min - b.min).filter((t, i, arr) => i === 0 || t.min !== arr[i - 1].min)

/** Vị trí bậc giá áp dụng cho `qty` chiếc (bậc cuối có min ≤ qty); -1 nếu không có bậc nào */
export function tierIndex(list: PriceTier[], qty: number) {
  let idx = -1
  list.forEach((t, i) => {
    if (qty >= t.min) idx = i
  })
  return idx === -1 && list.length ? 0 : idx
}

/** "1–9 chiếc" · "Từ 100 chiếc" */
export function tierLabel(list: PriceTier[], i: number) {
  const t = list[i]
  const next = list[i + 1]
  if (!t) return ''
  if (!next) return `Từ ${t.min} chiếc`
  return next.min - 1 === t.min ? `${t.min} chiếc` : `${t.min}–${next.min - 1} chiếc`
}

/** Tóm tắt giá cho danh sách sản phẩm */
export function priceSummary(p: ProductContent) {
  if (p.type === 'shirt') return p.price == null ? 'Chưa có giá' : fmtMoney(p.price)
  const prices = p.tiers.map((t) => t.price).filter((v): v is number => v != null)
  if (!prices.length) return 'Thương lượng'
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  return `${lo === hi ? fmtMoney(lo) : `${fmtMoney(lo)} – ${fmtMoney(hi)}`}/chiếc · ${p.tiers.length} bậc`
}

export const PRODUCT_TYPES = [
  { value: 'tag', label: 'Mác áo (tag)', color: 'gold' },
  { value: 'shirt', label: 'Áo', color: 'blue' },
] as const
