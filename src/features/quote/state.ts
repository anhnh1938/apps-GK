import { todayIso } from '../../lib/format'
import { uid } from '../../lib/file'
import { COLORS, DEFAULT_FONT, DEFAULT_PRODUCTS, SIZES } from './constants'
import type { Product, QuoteContent, QuoteItem } from './types'

export function newItem(from: Partial<QuoteItem> = {}): QuoteItem {
  return {
    id: uid(),
    productId: from.productId ?? DEFAULT_PRODUCTS[0]?.id ?? 'custom',
    name: '',
    color: from.color ?? COLORS[0].name,
    size: from.size ?? SIZES[0],
    qty: from.qty ?? 0,
    price: null,
    manual: false,
  }
}

export const DEFAULT_TITLE = 'BẢNG GIÁ TAG IN'
export const DEFAULT_SUBTITLE = 'Kích thước: 4 × 6 cm · 3 × 5 cm · 1.5 × 6 cm'
export const DEFAULT_NOTES = 'Màu in: In đầy đủ màu theo thiết kế.\nĐơn giá tính theo số lượng của từng loại tag.'

/**
 * Nội dung báo giá mới.
 * - `products`: bảng giá các sản phẩm mác áo đang bán (Quản lý sản phẩm), chụp lại vào báo giá.
 * - `template` (báo giá gần nhất): tiêu đề, ghi chú, font — giống bản gốc "Báo giá mới" giữ lại các phần này.
 */
export function defaultContent(template?: Partial<QuoteContent> | null, products: Product[] = DEFAULT_PRODUCTS): QuoteContent {
  const snapshot = structuredClone(products.length ? products : DEFAULT_PRODUCTS)
  return {
    customer: { name: '', phone: '', address: '' },
    date: todayIso(),
    font: template?.font ?? DEFAULT_FONT,
    title: template?.title ?? DEFAULT_TITLE,
    subtitle: template?.subtitle ?? DEFAULT_SUBTITLE,
    showPriceTables: template?.showPriceTables ?? true,
    showPayment: template?.showPayment ?? true,
    products: snapshot,
    items: [newItem({ productId: snapshot[0]?.id })],
    ship: null,
    printContent: '',
    notes: template?.notes ?? DEFAULT_NOTES,
  }
}
