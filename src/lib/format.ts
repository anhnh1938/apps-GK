export const pad2 = (n: number) => String(n).padStart(2, '0')

/** 1234567 → "1.234.567" (kiểu Việt Nam) */
export const fmtNum = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('vi-VN'))
export const fmtMoney = (n: number | null | undefined) => fmtNum(n) + 'đ'

/** "2026-11-16" → "16/11/2026" */
export function fmtDate(iso: string) {
  const [y, m, d] = (iso || '').split('-')
  return y ? `${d}/${m}/${y}` : ''
}

export function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** ["a", "b", "c"] → "a, b và c" */
export const joinVi = (arr: string[]) =>
  arr.length > 1 ? arr.slice(0, -1).join(', ') + ' và ' + arr[arr.length - 1] : (arr[0] ?? '')

/** So khớp không dấu, không phân biệt hoa thường: "my anh" khớp "Mỹ Anh" */
export const matchText = (haystack: (string | null | undefined)[], needle: string) => {
  const n = slug(needle).toLowerCase()
  return !n || haystack.some((h) => slug(h ?? '').toLowerCase().includes(n))
}

const dateTimeFmt = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
/** Date → "16/11 14:32" */
export const fmtDateTime = (d: Date | null) => (d ? dateTimeFmt.format(d) : '')
/** Khoảng ngày [đầu ngày bắt đầu, cuối ngày kết thúc]; null = không lọc */
export type DateRange = [Date, Date] | null

/** Khoảng ngày hôm nay (00:00 → 23:59:59.999) — bộ lọc ngày mặc định của các danh sách */
export function todayRange(): DateRange {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setHours(23, 59, 59, 999)
  return [start, end]
}

/** "2026-11-16" → Date (0h giờ máy) */
export const isoToDate = (iso: string) => {
  const [y, m, d] = (iso || '').split('-').map(Number)
  return y ? new Date(y, m - 1, d) : null
}

/** Ngày có nằm trong khoảng không (không lọc thì luôn đúng; không có ngày thì loại khi đang lọc) */
export const inDateRange = (d: Date | null, range: DateRange) =>
  !range || (d != null && d >= range[0] && d <= range[1])

/** Date → "16/11/2026" */
export const fmtDay = (d: Date | null) => (d ? `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}` : '')

/** Bỏ dấu tiếng Việt, chỉ giữ chữ số và dấu "-" — dùng làm tên file */
export const slug = (s: string) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
