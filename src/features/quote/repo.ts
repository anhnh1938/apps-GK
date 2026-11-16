import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import type { DocumentSnapshot } from 'firebase/firestore'
import { COL, currentEmail, db } from '../../lib/firebase'
import { toDate } from '../../lib/firestoreHooks'
import { todayIso } from '../../lib/format'
import { addImageSrc, deleteWithImages } from '../../lib/images'
import type { PendingImage } from '../../lib/images'
import type { ShippingInfo } from '../../lib/payment'
import {
  backToPaidUpdate,
  backToUnpaidUpdate,
  initialStatusFields,
  paidUpdate,
  percentUpdate,
  printedUpdate,
  readStatusFields,
  shippedUpdate,
  shippingUpdate,
} from '../../lib/statusFields'
import { computeQuote } from './calc'
import { defaultContent, newItem } from './state'
import { LEGACY_TAG_COLORS, LEGACY_TAG_SIZES, sortTiers, toColors, toPrintKind, toSizes } from '../products/catalog'
import type { Product, QuoteContent, QuoteDoc, Totals } from './types'

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
function toProductSnapshot(p: Partial<Product> & { prices?: (number | null)[] }): Product {
  return {
    id: String(p.id ?? ''),
    name: String(p.name ?? ''),
    tiers: Array.isArray(p.tiers)
      ? sortTiers(p.tiers)
      : LEGACY_TIER_MINS.map((min, i) => ({ min, price: p.prices?.[i] ?? null })),
    printKind: toPrintKind(p.printKind, String(p.id ?? ''), String(p.name ?? '')),
    // Báo giá tạo trước khi mác áo có màu / kích thước riêng: dùng lựa chọn cố định cũ (Trắng / Be, 3 kích thước)
    colors: Array.isArray(p.colors) ? toColors(p.colors) : LEGACY_TAG_COLORS,
    sizes: Array.isArray(p.sizes) ? toSizes(p.sizes) : LEGACY_TAG_SIZES,
  }
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

/**
 * Ghi báo giá mới lên Firestore (luôn ở "Chưa nhận tiền") — CHỈ gọi khi bấm "Tạo báo giá". Trả về id.
 * Ngày báo giá = ngày bấm tạo (không có ô sửa ngày).
 */
export async function createQuote(content: QuoteContent, images: PendingImage[] = []) {
  const ref = await addDoc(collection(db, COL.quotes), {
    ...content,
    date: todayIso(),
    totals: totalsOf(content),
    ...initialStatusFields(),
    createdAt: serverTimestamp(),
    createdBy: currentEmail(),
    ...stamp(),
  })
  for (const img of images) await addImageSrc(ref, img.kind, img.name, img.src)
  return ref.id
}

// Mỗi hàm chỉ ghi đúng các field của mình, nên trang sửa đang mở không ghi đè trạng thái / vận chuyển và ngược lại.
export const saveQuoteContent = (id: string, content: QuoteContent) =>
  updateDoc(quoteRef(id), { ...content, totals: totalsOf(content), ...stamp() })

// Trạng thái: đi tới từng bước, lùi lại được một bước. Đã nhận tiền thì báo giá bị khoá → trang sửa lưu nốt nội dung
// trước khi gọi markQuotePaid; lùi về "Chưa nhận tiền" thì mở khoá lại.
export const markQuotePaid = (id: string, percent: number) => updateDoc(quoteRef(id), { ...paidUpdate(percent), ...stamp() })
export const setQuotePaidPercent = (id: string, percent: number) =>
  updateDoc(quoteRef(id), { ...percentUpdate(percent), ...stamp() })
export const markQuoteShipped = (id: string) => updateDoc(quoteRef(id), { ...shippedUpdate(), ...stamp() })
export const revertQuoteToUnpaid = (id: string) => updateDoc(quoteRef(id), { ...backToUnpaidUpdate(), ...stamp() })
export const revertQuoteToPaid = (id: string) => updateDoc(quoteRef(id), { ...backToPaidUpdate(), ...stamp() })

export const saveQuoteShipping = (id: string, s: Pick<ShippingInfo, 'carrier' | 'trackingCode'>) =>
  updateDoc(quoteRef(id), { ...shippingUpdate(s), ...stamp() })

export const markQuoteLabelPrinted = (id: string) => updateDoc(quoteRef(id), { ...printedUpdate(), ...stamp() })

/** Trang mẫu câu sửa xuống dòng → ghi thẳng vào "Nội dung in" của báo giá (mẫu câu không có bản sao riêng) */
export const savePrintContent = (id: string, printContent: string) =>
  updateDoc(quoteRef(id), { printContent, ...stamp() })

export const deleteQuote = (id: string) => deleteWithImages(quoteRef(id))
