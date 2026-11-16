import { todayIso } from '../../lib/format'
import { uid } from '../../lib/file'
import { DEFAULT_FONT, DEFAULT_PRODUCTS } from './constants'
import type { Product, QuoteContent, QuoteItem } from './types'

/** Giữ `want` nếu sản phẩm có lựa chọn đó (hoặc sản phẩm chưa có danh sách); không thì lấy lựa chọn đầu */
const pick = (list: string[], want?: string) => (want && (!list.length || list.includes(want)) ? want : (list[0] ?? want ?? ''))

/** Màu / kích thước hợp lệ với sản phẩm (gọi khi đổi loại tag) */
export const fitToProduct = (product: Product | undefined, from: Pick<Partial<QuoteItem>, 'color' | 'size'>) => ({
  color: pick(product?.colors.map((c) => c.name) ?? [], from.color),
  size: pick(product?.sizes ?? [], from.size),
})

/** Dòng mới; có `product` thì màu / kích thước lấy theo sản phẩm (giữ của `from` nếu sản phẩm có) */
export function newItem(from: Partial<QuoteItem> = {}, product?: Product): QuoteItem {
  return {
    id: uid(),
    productId: from.productId ?? product?.id ?? DEFAULT_PRODUCTS[0]?.id ?? 'custom',
    name: '',
    ...fitToProduct(product, from),
    qty: from.qty ?? 0,
    price: null,
    manual: false,
  }
}

export const DEFAULT_TITLE = 'BẢNG GIÁ TAG IN'
export const DEFAULT_SUBTITLE = 'Kích thước: 4 × 6 cm gấp đôi · 3 × 5 cm · 1.5 × 6 cm · 4 × 8 cm gấp đôi'
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
    items: [newItem({ productId: snapshot[0]?.id }, snapshot[0])],
    ship: null,
    printContent: '',
    notes: template?.notes ?? DEFAULT_NOTES,
  }
}
