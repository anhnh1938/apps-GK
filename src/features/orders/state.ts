import { uid } from '../../lib/file'
import type { ProductDoc } from '../products/types'
import type { OrderContent, OrderItem, OrderTotals } from './types'

/** Áo mới theo sản phẩm: giữ màu / size của `from` nếu sản phẩm có, giá theo sản phẩm */
export function newOrderItem(product: ProductDoc | undefined, from: Partial<OrderItem> = {}): OrderItem {
  const colors = (product?.colors ?? []).map((c) => c.name)
  const sizes = product?.sizes ?? []
  return {
    id: uid(),
    productId: product?.id ?? from.productId ?? '',
    name: product?.name ?? from.name ?? 'Áo',
    color: from.color && colors.includes(from.color) ? from.color : (colors[0] ?? from.color ?? ''),
    size: from.size && sizes.includes(from.size) ? from.size : sizes.includes('M') ? 'M' : (sizes[0] ?? from.size ?? ''),
    qty: from.qty ?? 1,
    price: product?.price ?? from.price ?? null,
  }
}

export const defaultOrderContent = (firstShirt?: ProductDoc): OrderContent => ({
  recipient: { name: '', phone: '', address: '' },
  items: firstShirt ? [newOrderItem(firstShirt)] : [],
  tagContent: '',
  embroideryContent: '',
  ship: null,
  note: '',
})

export function orderTotals(c: Pick<OrderContent, 'items' | 'ship'>): OrderTotals {
  const qty = c.items.reduce((s, it) => s + it.qty, 0)
  const goods = c.items.reduce((s, it) => s + (it.price ?? 0) * it.qty, 0)
  return { qty, goods, grand: goods + (c.ship ?? 0) }
}

/** "Áo thun Đen L ×1, Áo polo Trắng M ×2" */
export const itemsSummary = (items: OrderItem[]) =>
  items
    .filter((it) => it.qty > 0)
    .map((it) => [it.name, it.color, it.size].filter(Boolean).join(' ') + ` ×${it.qty}`)
    .join(', ')

/** Mã đơn ngắn để đọc / ghi lên gói hàng: 6 ký tự cuối của id */
export const orderCode = (id: string) => '#' + id.slice(-6).toUpperCase()
