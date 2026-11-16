import { fmtMoney } from '../../lib/format'
import type { PriceTier, PrintKind, ProductColor, ProductContent, ProductDoc } from './types'

// Sản phẩm mặc định (nút "Tạo sản phẩm mặc định") — giá lấy từ bản báo giá gốc và "Shop facts" của D:\projects\ảnh GK.
// ID cố định "chu" / "hinh" / "thun" / "polo" trùng với dữ liệu báo giá / đơn áo cũ, nên dữ liệu cũ vẫn khớp.
const tiers = (prices: number[]): PriceTier[] => [1, 10, 20, 50, 100].map((min, i) => ({ min, price: prices[i] }))

/** Mã màu quen thuộc — dùng khi dữ liệu cũ chỉ có tên màu, hoặc gợi ý khi thêm màu mới */
export const KNOWN_COLORS: Record<string, string> = {
  Trắng: '#ffffff',
  Be: '#e8d9bf',
  Đen: '#1c1917',
  'Xanh than': '#1f2a44',
  Xám: '#9ca3af',
  Nâu: '#7c4a2d',
  Kem: '#f3ead8',
  Hồng: '#f4b6c2',
  Đỏ: '#c0392b',
  'Xanh lá': '#4a7c59',
}
export const colorOf = (name: string): ProductColor => ({ name, hex: KNOWN_COLORS[name] ?? '#cccccc' })

const HEX = /^#[0-9a-f]{6}$/i

/** Đọc danh sách màu từ Firestore: dạng mới `{ name, hex }`, hoặc dạng cũ chỉ có tên (`"Đen"`) */
export function toColors(v: unknown): ProductColor[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((c): ProductColor[] => {
    if (typeof c === 'string') return c.trim() ? [colorOf(c.trim())] : []
    if (c && typeof c === 'object' && typeof c.name === 'string' && c.name.trim()) {
      const name = c.name.trim()
      return [{ name, hex: typeof c.hex === 'string' && HEX.test(c.hex) ? c.hex.toLowerCase() : colorOf(name).hex }]
    }
    return []
  })
}

/** Đọc danh sách size: chuỗi khác rỗng */
export const toSizes = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : []

/** Bỏ dòng trống / trùng tên (giữ dòng đầu) trước khi lưu */
export const cleanColors = (list: ProductColor[]) =>
  toColors(list).filter((c, i, arr) => arr.findIndex((x) => x.name === c.name) === i)
export const cleanSizes = (list: string[]) => [...new Set(toSizes(list))]

/**
 * Lựa chọn để hiện trên form báo giá / đơn: danh sách của sản phẩm, thêm giá trị đang chọn nếu nó không còn trong
 * danh sách (sản phẩm đã đổi màu / size sau khi tạo đơn) — để đơn cũ vẫn hiện đúng lựa chọn.
 */
export function withCurrent<T>(list: T[], current: T | '' | null | undefined, key: (v: T) => string): T[] {
  if (!current || list.some((v) => key(v) === key(current))) return list
  return [...list, current]
}

/** Màu / kích thước mác áo mặc định (sản phẩm mặc định + seeding) */
export const DEFAULT_TAG_COLORS = ['Trắng', 'Be'].map(colorOf)
export const DEFAULT_TAG_SIZES = ['4 × 6 cm gấp đôi', '3 × 5 cm', '1.5 × 6 cm', '4 × 8 cm gấp đôi']

/** Lựa chọn cố định của form báo giá cũ — cho báo giá tạo trước khi mác áo có màu / kích thước riêng */
export const LEGACY_TAG_COLORS = ['Trắng', 'Be'].map(colorOf)
export const LEGACY_TAG_SIZES = ['4 × 6 cm', '3 × 5 cm', '1.5 × 6 cm']

export const DEFAULT_CATALOG: (ProductContent & { id: string })[] = [
  {
    id: 'chu',
    type: 'tag',
    name: 'Tag in chữ',
    active: true,
    note: '',
    tiers: tiers([28000, 25000, 22000, 20000, 18000]),
    printKind: 'text',
    price: null,
    colors: DEFAULT_TAG_COLORS,
    sizes: DEFAULT_TAG_SIZES,
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
    printKind: 'image',
    price: null,
    colors: DEFAULT_TAG_COLORS,
    sizes: DEFAULT_TAG_SIZES,
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
    printKind: 'text',
    price: 229000,
    colors: ['Xanh than', 'Trắng', 'Đen'].map(colorOf),
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
    printKind: 'text',
    price: 269000,
    colors: ['Đen', 'Trắng', 'Xanh than'].map(colorOf),
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

/** Mác áo: số lượng trên báo giá tính theo gì */
export const PRINT_KINDS = [
  { value: 'text', label: 'Số câu', unit: 'câu', help: 'tag in chữ — mỗi câu ở “Nội dung in” là 1 tag' },
  { value: 'image', label: 'Số ảnh', unit: 'ảnh', help: 'tag in hình — mỗi ảnh / thiết kế ở “Nội dung in” là 1 tag' },
] as const satisfies readonly { value: PrintKind; label: string; unit: string; help: string }[]

export const printKindUnit = (k: PrintKind) => PRINT_KINDS.find((x) => x.value === k)?.unit ?? ''

/** Dữ liệu chưa có `printKind`: đoán theo id / tên ("hinh", "Tag in hình" → số ảnh; còn lại → số câu) */
export function toPrintKind(v: unknown, id: string, name: string): PrintKind {
  if (v === 'text' || v === 'image') return v
  return id === 'hinh' || /hình/i.test(name) ? 'image' : 'text'
}

export const PRODUCT_TYPES = [
  { value: 'tag', label: 'Mác áo (tag)', color: 'gold' },
  { value: 'shirt', label: 'Áo', color: 'blue' },
] as const
