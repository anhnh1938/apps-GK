import { addDoc, collection, doc, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import type { DocumentSnapshot } from 'firebase/firestore'
import { COL, currentEmail, db } from '../../lib/firebase'
import { toDate } from '../../lib/firestoreHooks'
import { addImageSrc, deleteWithImages } from '../../lib/images'
import type { PendingImage } from '../../lib/images'
import type { ShippingInfo } from '../../lib/payment'
import { initialStatusFields, printedUpdate, readStatusFields, shippingUpdate, statusUpdate } from '../../lib/statusFields'
import { uid } from '../../lib/file'
import { defaultOrderContent, orderTotals } from './state'
import type { OrderContent, OrderDoc, OrderItem, OrderStatus, OrderTotals } from './types'

// Đơn áo: collection gk_orders. Cấu trúc đầy đủ: docs/firestore.md

export const orderRef = (id: string) => doc(db, COL.orders, id)
export const ordersQuery = () => query(collection(db, COL.orders), orderBy('createdAt', 'desc'))

export function orderContentOf(o: OrderContent): OrderContent {
  const { recipient, items, tagContent, embroideryContent, ship, note } = o
  return { recipient, items, tagContent, embroideryContent, ship, note }
}

// Đơn cũ lưu loại áo ở `shirtType` ("thun" / "polo") và không có tên — đổi sang productId + name
const LEGACY_SHIRT_NAMES: Record<string, string> = { thun: 'Áo thun', polo: 'Áo polo' }
function toOrderItem(raw: Partial<OrderItem> & { shirtType?: string }): OrderItem {
  const productId = raw.productId ?? raw.shirtType ?? ''
  return {
    id: raw.id ?? uid(),
    productId,
    name: raw.name ?? LEGACY_SHIRT_NAMES[productId] ?? 'Áo',
    color: raw.color ?? '',
    size: raw.size ?? '',
    qty: typeof raw.qty === 'number' ? raw.qty : 1,
    price: typeof raw.price === 'number' ? raw.price : null,
  }
}

export function toOrder(snap: DocumentSnapshot): OrderDoc {
  const d = (snap.data() ?? {}) as Record<string, unknown> & Partial<OrderContent>
  const base = defaultOrderContent()
  return {
    ...orderContentOf({ ...base, ...d }),
    recipient: { ...base.recipient, ...d.recipient },
    items: Array.isArray(d.items) ? d.items.map(toOrderItem) : base.items,
    id: snap.id,
    ...readStatusFields(d),
    totals: (d.totals as OrderTotals) ?? orderTotals(base),
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
    createdBy: (d.createdBy as string) ?? null,
    updatedBy: (d.updatedBy as string) ?? null,
  }
}

const stamp = () => ({ updatedAt: serverTimestamp(), updatedBy: currentEmail() })

/** Ghi đơn áo mới lên Firestore — CHỈ gọi khi người dùng bấm "Tạo đơn áo". Trả về id. */
export async function createOrder(
  content: OrderContent,
  status: OrderStatus,
  paidPercent: number | null,
  images: PendingImage[] = [],
) {
  const ref = await addDoc(collection(db, COL.orders), {
    ...content,
    totals: orderTotals(content),
    ...initialStatusFields(),
    createdAt: serverTimestamp(),
    createdBy: currentEmail(),
    ...stamp(),
  })
  for (const img of images) await addImageSrc(ref, img.kind, img.name, img.src)
  if (status !== 'unpaid') await setOrderStatus(ref.id, status, paidPercent)
  return ref.id
}

// Mỗi hàm chỉ ghi đúng các field của mình (trang sửa không ghi đè trạng thái / vận chuyển và ngược lại)
export const saveOrderContent = (id: string, content: OrderContent) =>
  updateDoc(orderRef(id), { ...content, totals: orderTotals(content), ...stamp() })

export const setOrderStatus = (id: string, status: OrderStatus, paidPercent: number | null) =>
  updateDoc(orderRef(id), { ...statusUpdate(status, paidPercent), ...stamp() })

export const saveOrderShipping = (id: string, s: Pick<ShippingInfo, 'carrier' | 'trackingCode'>) =>
  updateDoc(orderRef(id), { ...shippingUpdate(s), ...stamp() })

export const markOrderLabelPrinted = (id: string) => updateDoc(orderRef(id), { ...printedUpdate(), ...stamp() })

export const deleteOrder = (id: string) => deleteWithImages(orderRef(id))
