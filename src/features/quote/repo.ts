import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import type { DocumentSnapshot } from 'firebase/firestore'
import { COL, currentEmail, db } from '../../lib/firebase'
import { toDate } from '../../lib/firestoreHooks'
import { addImageSrc, deleteWithImages } from '../../lib/images'
import type { PendingImage } from '../../lib/images'
import type { ShippingInfo } from '../../lib/payment'
import { initialStatusFields, printedUpdate, readStatusFields, shippingUpdate, statusUpdate } from '../../lib/statusFields'
import { computeQuote } from './calc'
import { defaultContent, newItem } from './state'
import { sortTiers } from '../products/catalog'
import type { Product, QuoteContent, QuoteDoc, QuoteStatus, Totals } from './types'

// Báo giá mác áo rời: collection gk_quotes. Cấu trúc đầy đủ: docs/firestore.md

export const quoteRef = (id: string) => doc(db, COL.quotes, id)
export const quotesQuery = () => query(collection(db, COL.quotes), orderBy('createdAt', 'desc'))

/** Tách phần nội dung (trang sửa tự lưu) ra khỏi document */
export function contentOf(q: QuoteContent): QuoteContent {
  const { customer, date, font, title, subtitle, showPriceTables, showPayment, products, items, ship, printContent, notes } = q
  return { customer, date, font, title, subtitle, showPriceTables, showPayment, products, items, ship, printContent, notes }
}

// Báo giá cũ lưu bảng giá dạng `prices: [5 giá]` theo 5 bậc cố định 1 / 10 / 20 / 50 / 100 chiếc
const LEGACY_TIER_MINS = [1, 10, 20, 50, 100]
function toProductSnapshot(p: Product & { prices?: (number | null)[] }): Product {
  if (Array.isArray(p.tiers)) return { id: p.id, name: p.name, tiers: sortTiers(p.tiers) }
  return { id: p.id, name: p.name, tiers: LEGACY_TIER_MINS.map((min, i) => ({ min, price: p.prices?.[i] ?? null })) }
}

/** Document Firestore → QuoteDoc, điền mặc định cho field thiếu (dữ liệu cũ / sửa tay trong Console) */
export function toQuote(snap: DocumentSnapshot): QuoteDoc {
  const d = (snap.data() ?? {}) as Record<string, unknown> & Partial<QuoteContent>
  const base = defaultContent()
  return {
    ...base,
    ...contentOf({ ...base, ...d }),
    customer: { ...base.customer, ...d.customer },
    products: Array.isArray(d.products) && d.products.length ? d.products.map(toProductSnapshot) : base.products,
    items: Array.isArray(d.items) ? d.items.map((it) => ({ ...newItem(), ...it })) : base.items,
    id: snap.id,
    ...readStatusFields(d),
    totals: (d.totals as Totals) ?? { qty: 0, goods: 0, grand: 0 },
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
    createdBy: (d.createdBy as string) ?? null,
    updatedBy: (d.updatedBy as string) ?? null,
  }
}

const totalsOf = (c: QuoteContent): Totals => {
  const { qty, goods, grand } = computeQuote(c)
  return { qty, goods, grand }
}
const stamp = () => ({ updatedAt: serverTimestamp(), updatedBy: currentEmail() })

/** Nội dung báo giá gần nhất — báo giá mới lấy bảng giá / tiêu đề / ghi chú theo nó */
export async function latestQuoteContent(): Promise<QuoteContent | null> {
  const snap = await getDocs(query(collection(db, COL.quotes), orderBy('createdAt', 'desc'), limit(1)))
  return snap.empty ? null : contentOf(toQuote(snap.docs[0]))
}

/** Ghi báo giá mới lên Firestore — CHỈ gọi khi người dùng bấm "Tạo báo giá". Trả về id. */
export async function createQuote(
  content: QuoteContent,
  status: QuoteStatus,
  paidPercent: number | null,
  images: PendingImage[] = [],
) {
  // Tạo ở "Chưa nhận tiền" rồi mới thêm ảnh: đã nhận tiền thì rules khoá, không thêm ảnh được nữa
  const ref = await addDoc(collection(db, COL.quotes), {
    ...content,
    totals: totalsOf(content),
    ...initialStatusFields(),
    createdAt: serverTimestamp(),
    createdBy: currentEmail(),
    ...stamp(),
  })
  for (const img of images) await addImageSrc(ref, img.kind, img.name, img.src)
  if (status !== 'unpaid') await setQuoteStatus(ref.id, status, paidPercent)
  return ref.id
}

// Mỗi hàm chỉ ghi đúng các field của mình, nên trang sửa đang mở không ghi đè trạng thái / vận chuyển và ngược lại.
export const saveQuoteContent = (id: string, content: QuoteContent) =>
  updateDoc(quoteRef(id), { ...content, totals: totalsOf(content), ...stamp() })

export const setQuoteStatus = (id: string, status: QuoteStatus, paidPercent: number | null) =>
  updateDoc(quoteRef(id), { ...statusUpdate(status, paidPercent), ...stamp() })

export const saveQuoteShipping = (id: string, s: Pick<ShippingInfo, 'carrier' | 'trackingCode'>) =>
  updateDoc(quoteRef(id), { ...shippingUpdate(s), ...stamp() })

export const markQuoteLabelPrinted = (id: string) => updateDoc(quoteRef(id), { ...printedUpdate(), ...stamp() })

/** Trang mẫu câu sửa xuống dòng → ghi thẳng vào "Nội dung in" của báo giá (mẫu câu không có bản sao riêng) */
export const savePrintContent = (id: string, printContent: string) =>
  updateDoc(quoteRef(id), { printContent, ...stamp() })

export const deleteQuote = (id: string) => deleteWithImages(quoteRef(id))
