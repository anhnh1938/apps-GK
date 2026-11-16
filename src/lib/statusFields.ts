import { serverTimestamp } from 'firebase/firestore'
import { toDate } from './firestoreHooks'
import { normalizeStatus, PAY_STATUSES } from './payment'
import type { PayStatus, ShippingInfo } from './payment'

// Field trạng thái / vận chuyển dùng chung cho gk_quotes và gk_orders (xem docs/firestore.md).

export interface StatusFields {
  status: PayStatus
  paidPercent: number | null
  statusAt: Partial<Record<PayStatus, Date | null>>
  shipping: ShippingInfo
}

/** Đọc từ document (kể cả dữ liệu cũ: paidAt, status "done") */
export function readStatusFields(d: Record<string, unknown>): StatusFields {
  const status = normalizeStatus(d.status)
  const at = (d.statusAt ?? {}) as Record<string, unknown>
  const shipping = (d.shipping ?? {}) as Record<string, unknown>
  return {
    status,
    paidPercent: status === 'unpaid' ? null : typeof d.paidPercent === 'number' ? d.paidPercent : 100,
    statusAt: Object.fromEntries(
      PAY_STATUSES.map((s) => [s.value, toDate(at[s.value]) ?? (s.value === 'paid' ? toDate(d.paidAt ?? at.done) : null)]),
    ),
    shipping: {
      carrier: typeof shipping.carrier === 'string' ? shipping.carrier : '',
      trackingCode: typeof shipping.trackingCode === 'string' ? shipping.trackingCode : '',
      printedAt: toDate(shipping.printedAt),
    },
  }
}

/** Field ghi khi tạo document mới */
export const initialStatusFields = () => ({
  status: 'unpaid' as PayStatus,
  paidPercent: null,
  statusAt: { unpaid: serverTimestamp() },
  shipping: { carrier: '', trackingCode: '', printedAt: null },
})

/** Đổi trạng thái / % đã nhận — chỉ đụng các field trạng thái */
export const statusUpdate = (status: PayStatus, paidPercent: number | null) => ({
  status,
  paidPercent: status === 'unpaid' ? null : (paidPercent ?? 100),
  [`statusAt.${status}`]: serverTimestamp(),
})

/** Sửa đơn vị vận chuyển / mã vận đơn */
export const shippingUpdate = (s: Pick<ShippingInfo, 'carrier' | 'trackingCode'>) => ({
  'shipping.carrier': s.carrier,
  'shipping.trackingCode': s.trackingCode,
})

/** Bấm "In mã vận chuyển" → đánh dấu đã in */
export const printedUpdate = () => ({ 'shipping.printedAt': serverTimestamp() })
