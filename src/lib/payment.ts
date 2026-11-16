// Trạng thái chung của báo giá và đơn áo: Chưa nhận tiền → Đã nhận tiền (bao nhiêu %) → Đã mang ra bưu cục.

export type PayStatus = 'unpaid' | 'paid' | 'shipped'

export const PAY_STATUSES = [
  { value: 'unpaid', label: 'Chưa nhận tiền', color: 'orange' },
  { value: 'paid', label: 'Đã nhận tiền', color: 'blue' },
  { value: 'shipped', label: 'Đã mang ra bưu cục', color: 'green' },
] as const satisfies readonly { value: PayStatus; label: string; color: string }[]

/**
 * Trạng thái đi tới từng bước: Chưa nhận tiền → Đã nhận tiền → Đã mang ra bưu cục; bấm nhầm thì lùi lại đúng một bước.
 * Đã nhận tiền / đã mang ra bưu cục vẫn sửa được % đã nhận. Firestore rules (`validStatusChange`) chặn y như vậy.
 */
export const PREV_STATUS: Record<PayStatus, PayStatus | null> = { unpaid: null, paid: 'unpaid', shipped: 'paid' }

/** Mức % gợi ý khi chọn "Đã nhận tiền" */
export const PERCENT_PRESETS = [30, 50, 100] as const

/** Dữ liệu cũ / sửa tay: "done" (Đã làm xong, bản trước) coi như đã nhận tiền; giá trị lạ → chưa nhận tiền */
export function normalizeStatus(v: unknown): PayStatus {
  if (v === 'paid' || v === 'shipped' || v === 'unpaid') return v
  if (v === 'done') return 'paid'
  return 'unpaid'
}

/** % đã nhận: chưa nhận tiền = 0; đã nhận nhưng thiếu số (dữ liệu cũ) = 100 */
export const percentOf = (status: PayStatus, paidPercent: number | null | undefined) =>
  status === 'unpaid' ? 0 : Math.min(100, Math.max(0, paidPercent ?? 100))

export function paymentAmounts(grand: number, status: PayStatus, paidPercent: number | null | undefined) {
  const percent = percentOf(status, paidPercent)
  const received = Math.round((grand * percent) / 100)
  return { percent, received, remaining: grand - received }
}

/** "Chưa nhận tiền" · "Đã nhận 50%" · "Đã mang ra bưu cục" */
export function statusText(status: PayStatus, paidPercent: number | null | undefined) {
  if (status === 'paid') return `Đã nhận ${percentOf(status, paidPercent)}%`
  return PAY_STATUSES.find((s) => s.value === status)?.label ?? status
}

export const statusColor = (status: PayStatus) => PAY_STATUSES.find((s) => s.value === status)?.color

// ---------- Vận chuyển (khi "Đã mang ra bưu cục") ----------

export interface ShippingInfo {
  carrier: string
  /** Mã vận đơn của đơn vị vận chuyển */
  trackingCode: string
  /** Lúc bấm "In mã vận chuyển" gần nhất; null = chưa in */
  printedAt: Date | null
}

export const EMPTY_SHIPPING: ShippingInfo = { carrier: '', trackingCode: '', printedAt: null }

export const CARRIERS = [
  'GHTK',
  'GHN',
  'Viettel Post',
  'J&T Express',
  'VNPost',
  'SPX Express',
  'Ninja Van',
  'Best Express',
  'Ahamove',
]

/** Tài khoản nhận tiền — phải khớp ảnh QR src/assets/qr.jpg (lấy từ QR_SRC của bản báo giá gốc) */
export const BANK = {
  name: 'BIDV',
  fullName: 'Ngân hàng TMCP Đầu tư & Phát triển Việt Nam',
  account: '4270783532',
  holder: 'TRAN THI LINH',
}

/** Thông tin người gửi in trên tem (theo "Shop facts" của D:\projects\ảnh GK) */
export const SENDER = { name: 'Góc Kể Studio', phone: '0862 618 680', social: '@gockestudio' }
