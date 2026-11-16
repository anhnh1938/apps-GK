import { isoToDate, pad2 } from '../../lib/format'
import type { DateRange } from '../../lib/format'
import { paymentAmounts } from '../../lib/payment'
import type { PayStatus } from '../../lib/payment'
import type { OrderDoc } from '../orders/types'
import { CUSTOM } from '../quote/constants'
import type { QuoteDoc } from '../quote/types'

// Số liệu cho Dashboard, tính từ danh sách báo giá + đơn áo (đã tải realtime).
// Ngày của báo giá = "Ngày báo giá"; ngày của đơn áo = ngày tạo đơn.

export interface Bucket {
  key: string
  label: string
  quotes: number
  orders: number
}

export interface ToShip {
  kind: 'quote' | 'order'
  id: string
  name: string
  phone: string
  grand: number
  remaining: number
  paidAt: Date | null
}

const quoteDay = (q: QuoteDoc) => isoToDate(q.date)
const orderDay = (o: OrderDoc) => o.createdAt
const inRange = (d: Date | null, [from, to]: [Date, Date]) => d != null && d >= from && d <= to
const emptyStatus = (): Record<PayStatus, number> => ({ unpaid: 0, paid: 0, shipped: 0 })

/** Chia khoảng ngày thành cột: theo ngày nếu ≤ 62 ngày, dài hơn thì theo tháng */
function makeBuckets([from, to]: [Date, Date]) {
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000)
  const byMonth = days > 62
  const buckets: Bucket[] = []
  const keyOf = (d: Date) =>
    byMonth ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  const cur = new Date(from.getFullYear(), from.getMonth(), byMonth ? 1 : from.getDate())
  while (cur <= to) {
    buckets.push({
      key: keyOf(cur),
      label: byMonth ? `${pad2(cur.getMonth() + 1)}/${cur.getFullYear()}` : `${pad2(cur.getDate())}/${pad2(cur.getMonth() + 1)}`,
      quotes: 0,
      orders: 0,
    })
    if (byMonth) cur.setMonth(cur.getMonth() + 1)
    else cur.setDate(cur.getDate() + 1)
  }
  return { buckets, keyOf, byMonth }
}

function addQty(map: Map<string, number>, name: string, qty: number) {
  if (qty > 0) map.set(name, (map.get(name) ?? 0) + qty)
}
const ranked = (map: Map<string, number>) => [...map].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

export function buildDashboard(quotes: QuoteDoc[], orders: OrderDoc[], range: Exclude<DateRange, null>) {
  const q = quotes.filter((it) => inRange(quoteDay(it), range))
  const o = orders.filter((it) => inRange(orderDay(it), range))

  const amounts = (grand: number, status: PayStatus, pct: number | null) => paymentAmounts(grand, status, pct)
  const all = [
    ...q.map((it) => amounts(it.totals.grand, it.status, it.paidPercent)),
    ...o.map((it) => amounts(it.totals.grand, it.status, it.paidPercent)),
  ]
  const kpi = {
    total: [...q, ...o].reduce((s, it) => s + it.totals.grand, 0),
    received: all.reduce((s, a) => s + a.received, 0),
    remaining: all.reduce((s, a) => s + a.remaining, 0),
    quotes: q.length,
    quotesUnpaid: q.filter((it) => it.status === 'unpaid').length,
    orders: o.length,
    ordersUnpaid: o.filter((it) => it.status === 'unpaid').length,
  }

  const { buckets, keyOf, byMonth } = makeBuckets(range)
  const index = new Map(buckets.map((b) => [b.key, b]))
  for (const it of q) {
    const d = quoteDay(it)
    const b = d && index.get(keyOf(d))
    if (b) b.quotes += it.totals.grand
  }
  for (const it of o) {
    const d = orderDay(it)
    const b = d && index.get(keyOf(d))
    if (b) b.orders += it.totals.grand
  }

  const statusQuotes = emptyStatus()
  q.forEach((it) => statusQuotes[it.status]++)
  const statusOrders = emptyStatus()
  o.forEach((it) => statusOrders[it.status]++)

  const tags = new Map<string, number>()
  for (const it of q) {
    for (const line of it.items) {
      const name =
        line.productId === CUSTOM
          ? line.name || 'Sản phẩm khác'
          : (it.products.find((p) => p.id === line.productId)?.name ?? 'Sản phẩm khác')
      addQty(tags, name, line.qty)
    }
  }
  const shirts = new Map<string, number>()
  for (const it of o) for (const line of it.items) addQty(shirts, line.name || 'Áo', line.qty)

  return { kpi, buckets, byMonth, statusQuotes, statusOrders, tagProducts: ranked(tags), shirtProducts: ranked(shirts) }
}

/** Đã nhận tiền nhưng chưa mang ra bưu cục — không giới hạn theo ngày (là việc cần làm) */
export function toShipList(quotes: QuoteDoc[], orders: OrderDoc[]): ToShip[] {
  const list: ToShip[] = [
    ...quotes
      .filter((it) => it.status === 'paid')
      .map((it) => ({
        kind: 'quote' as const,
        id: it.id,
        name: it.customer.name,
        phone: it.customer.phone,
        grand: it.totals.grand,
        remaining: paymentAmounts(it.totals.grand, it.status, it.paidPercent).remaining,
        paidAt: it.statusAt.paid ?? null,
      })),
    ...orders
      .filter((it) => it.status === 'paid')
      .map((it) => ({
        kind: 'order' as const,
        id: it.id,
        name: it.recipient.name,
        phone: it.recipient.phone,
        grand: it.totals.grand,
        remaining: paymentAmounts(it.totals.grand, it.status, it.paidPercent).remaining,
        paidAt: it.statusAt.paid ?? null,
      })),
  ]
  // Nhận tiền lâu nhất lên đầu
  return list.sort((a, b) => (a.paidAt?.getTime() ?? 0) - (b.paidAt?.getTime() ?? 0))
}

/** 1.043.000 → "1,04tr" · 250.000 → "250k" — trục biểu đồ */
export function fmtCompactVnd(n: number) {
  const f = (v: number, unit: string) => `${v.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}${unit}`
  if (n >= 1e9) return f(n / 1e9, ' tỷ')
  if (n >= 1e6) return f(n / 1e6, 'tr')
  if (n >= 1e3) return f(n / 1e3, 'k')
  return String(n)
}
