import { deleteField, serverTimestamp } from 'firebase/firestore'
import { toDate } from './firestoreHooks'
import { normalizeStatus, PAY_STATUSES } from './payment'
import type { PayStatus, ShippingInfo } from './payment'

// Field trạng thái / vận chuyển dùng chung cho gk_quotes và gk_orders (xem docs/firestore.md).
//
// Mỗi thao tác là một lệnh ghi riêng, chỉ đụng đúng field của nó:
//   paidUpdate     Chưa nhận tiền → Đã nhận tiền: status, paidPercent, statusAt.paid
//   percentUpdate  sửa % đã nhận:                  CHỈ paidPercent (giữ nguyên trạng thái và các mốc giờ)
//   shippedUpdate  Đã nhận tiền → Đã mang ra bưu cục: status, statusAt.shipped (giữ nguyên %)
// Lùi một bước (bấm nhầm):
//   backToUnpaidUpdate  Đã nhận tiền → Chưa nhận tiền: bỏ paidPercent, xoá statusAt.paid / statusAt.shipped
//   backToPaidUpdate    Đã mang ra bưu cục → Đã nhận tiền: xoá statusAt.shipped (giữ %, giữ thông tin vận chuyển)

/** Đổi mốc giờ trạng thái trên giao diện: Date = vừa xong bước đó, null = bỏ mốc (khi lùi lại) */
export type StatusAtPatch = Partial<Record<PayStatus, Date | null>>

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
      PAY_STATUSES.map((s) => [
        s.value,
        // Dữ liệu cũ: mốc "đã nhận tiền" nằm ở paidAt / statusAt.done (chỉ dùng khi đang ở bước đó trở đi)
        toDate(at[s.value]) ?? (s.value === 'paid' && status !== 'unpaid' ? toDate(d.paidAt ?? at.done) : null),
      ]),
    ),
    shipping: {
      carrier: typeof shipping.carrier === 'string' ? shipping.carrier : '',
      trackingCode: typeof shipping.trackingCode === 'string' ? shipping.trackingCode : '',
      printedAt: toDate(shipping.printedAt),
    },
  }
}

/** Field ghi khi tạo document mới — luôn bắt đầu ở "Chưa nhận tiền" */
export const initialStatusFields = () => ({
  status: 'unpaid' as PayStatus,
  paidPercent: null,
  statusAt: { unpaid: serverTimestamp() },
  shipping: { carrier: '', trackingCode: '', printedAt: null },
})

const checkPercent = (percent: number) => {
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) throw new Error('% đã nhận phải từ 1 đến 100')
  return percent
}

export const paidUpdate = (percent: number) => ({
  status: 'paid' as PayStatus,
  paidPercent: checkPercent(percent),
  'statusAt.paid': serverTimestamp(),
})

export const percentUpdate = (percent: number) => ({ paidPercent: checkPercent(percent) })

export const shippedUpdate = () => ({
  status: 'shipped' as PayStatus,
  'statusAt.shipped': serverTimestamp(),
})

export const backToUnpaidUpdate = () => ({
  status: 'unpaid' as PayStatus,
  paidPercent: null,
  'statusAt.paid': deleteField(),
  'statusAt.shipped': deleteField(),
})

export const backToPaidUpdate = () => ({
  status: 'paid' as PayStatus,
  'statusAt.shipped': deleteField(),
})

/** Sửa đơn vị vận chuyển / mã vận đơn */
export const shippingUpdate = (s: Pick<ShippingInfo, 'carrier' | 'trackingCode'>) => ({
  'shipping.carrier': s.carrier,
  'shipping.trackingCode': s.trackingCode,
})

/** Bấm "In mã vận chuyển" → đánh dấu đã in */
export const printedUpdate = () => ({ 'shipping.printedAt': serverTimestamp() })
