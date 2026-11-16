import { fmtMoney } from '../../lib/format'
import { tierIndex, tierLabel } from '../products/catalog'
import type { PrintKind } from '../products/types'
import { parseList } from '../sentences/state'
import type { Product, QuoteContent, QuoteItem } from './types'

export const productOf = (products: Product[], it: QuoteItem) => products.find((p) => p.id === it.productId)

/** Số tag theo "Nội dung in": số câu (cùng cách tách với trang Mẫu câu) và số ảnh */
export const printCounts = (printContent: string, imageCount: number): Record<PrintKind, number> => ({
  text: parseList(printContent).length,
  image: imageCount,
})

/**
 * Số lượng dòng mác áo tự tính từ "Nội dung in": tag in chữ = số câu, tag in hình = số ảnh; đơn giá theo bảng giá.
 * Mỗi loại chỉ tính ở dòng đầu tiên của loại đó (dòng trùng loại = 0). Dòng "Sản phẩm khác" giữ số nhập tay.
 * Không có gì đổi → trả lại đúng object cũ (để tự lưu không ghi thừa).
 */
export function withAutoQty<T extends Pick<QuoteContent, 'items' | 'products' | 'printContent'>>(content: T, imageCount: number): T {
  const counts = printCounts(content.printContent, imageCount)
  const used = new Set<PrintKind>()
  let changed = false
  const items = content.items.map((it) => {
    const p = productOf(content.products, it)
    if (!p) return it
    const qty = used.has(p.printKind) ? 0 : counts[p.printKind]
    used.add(p.printKind)
    if (it.qty === qty && !it.manual) return it
    changed = true
    return { ...it, qty, manual: false }
  })
  return changed ? { ...content, items } : content
}

export interface PricedLine {
  item: QuoteItem
  product: Product | undefined
  /** Đơn giá đang áp dụng; null = thương lượng / chưa nhập */
  price: number | null
  /** price × qty; null nếu chưa có giá */
  total: number | null
  /** Giá theo bảng (để gợi ý khi đang nhập tay) */
  autoPrice: number | null
  /** Tổng số lượng của loại tag này trong đơn */
  productQty: number
  /** Nhãn bậc giá đang áp dụng, VD "10–19 chiếc" */
  tier: string
}

export interface QuoteCalc {
  /** Tổng số lượng theo từng loại tag (productId → số chiếc) */
  totals: Record<string, number>
  /** Mọi dòng trong form, kèm giá đang áp dụng */
  rows: PricedLine[]
  /** Dòng có số lượng > 0 — dòng hiện trên báo giá */
  lines: PricedLine[]
  qty: number
  goods: number
  grand: number
  /** Có dòng chưa có đơn giá (tổng chưa tính phần đó) */
  unpriced: boolean
}

export function computeQuote(state: Pick<QuoteContent, 'items' | 'products' | 'ship'>): QuoteCalc {
  const totals: Record<string, number> = {}
  for (const it of state.items) {
    if (productOf(state.products, it)) totals[it.productId] = (totals[it.productId] ?? 0) + it.qty
  }

  // Đơn giá tự tính theo bậc của TỔNG số lượng từng loại tag, trừ khi nhập tay
  const rows = state.items.map((item): PricedLine => {
    const product = productOf(state.products, item)
    const productQty = product ? (totals[product.id] ?? 0) : 0
    const ti = product ? tierIndex(product.tiers, productQty) : -1
    const autoPrice = product ? (product.tiers[ti]?.price ?? null) : null
    const price = product && !item.manual ? autoPrice : item.price
    const tier = product ? tierLabel(product.tiers, ti) : ''
    return { item, product, price, total: price == null ? null : price * item.qty, autoPrice, productQty, tier }
  })

  const lines = rows.filter((r) => r.item.qty > 0)
  const qty = lines.reduce((s, r) => s + r.item.qty, 0)
  const goods = lines.reduce((s, r) => s + (r.total ?? 0), 0)
  return {
    totals,
    rows,
    lines,
    qty,
    goods,
    grand: goods + (state.ship ?? 0),
    unpriced: lines.some((r) => r.price == null),
  }
}

export const itemName = (r: PricedLine) => r.product?.name || r.item.name || 'Sản phẩm khác'

/** "Tag in chữ ×42, Tag in hình ×1" — danh sách báo giá, tem vận chuyển */
export const quoteItemsSummary = (q: Pick<QuoteContent, 'items' | 'products'>) =>
  q.items
    .filter((it) => it.qty > 0)
    .map((it) => `${q.products.find((p) => p.id === it.productId)?.name || it.name || 'Sản phẩm khác'} ×${it.qty}`)
    .join(', ')

export const shipText = (ship: number | null) =>
  ship == null ? 'Không tính' : ship === 0 ? 'Miễn phí' : fmtMoney(ship)
