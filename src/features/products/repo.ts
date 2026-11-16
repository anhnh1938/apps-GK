import { useMemo } from 'react'
import { addDoc, collection, deleteDoc, doc, orderBy, query, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import type { DocumentSnapshot } from 'firebase/firestore'
import { COL, currentEmail, db } from '../../lib/firebase'
import { toDate, useLiveQuery } from '../../lib/firestoreHooks'
import {
  DEFAULT_CATALOG,
  FALLBACK_PRODUCTS,
  cleanColors,
  cleanSizes,
  sortTiers,
  toColors,
  toPrintKind,
  toSizes,
} from './catalog'
import type { PriceTier, ProductContent, ProductDoc } from './types'

// Sản phẩm: collection gk_products. Cấu trúc: docs/firestore.md. Chỉ role admin được ghi (rules).

export const productRef = (id: string) => doc(db, COL.products, id)
export const productsQuery = () => query(collection(db, COL.products), orderBy('sortOrder'))

export function toProduct(snap: DocumentSnapshot): ProductDoc {
  const d = (snap.data() ?? {}) as Record<string, unknown>
  return {
    id: snap.id,
    type: d.type === 'shirt' ? 'shirt' : 'tag',
    name: typeof d.name === 'string' ? d.name : '',
    active: d.active !== false,
    note: typeof d.note === 'string' ? d.note : '',
    tiers: Array.isArray(d.tiers) ? sortTiers(d.tiers as PriceTier[]) : [],
    printKind: toPrintKind(d.printKind, snap.id, typeof d.name === 'string' ? d.name : ''),
    price: typeof d.price === 'number' ? d.price : null,
    colors: toColors(d.colors),
    sizes: toSizes(d.sizes),
    spec: typeof d.spec === 'string' ? d.spec : '',
    sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 0,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
    createdBy: (d.createdBy as string) ?? null,
    updatedBy: (d.updatedBy as string) ?? null,
  }
}

/** Chỉ giữ field đúng loại (mác áo: bảng giá; áo: giá / mô tả). Cả hai loại đều có màu và size. */
export function productContentOf(p: ProductContent): ProductContent {
  const base = {
    type: p.type,
    name: p.name.trim(),
    active: p.active,
    note: p.note ?? '',
    colors: cleanColors(p.colors ?? []),
    sizes: cleanSizes(p.sizes ?? []),
    sortOrder: p.sortOrder,
  }
  return p.type === 'tag'
    ? { ...base, tiers: sortTiers(p.tiers), printKind: p.printKind ?? 'text', price: null, spec: '' }
    : { ...base, tiers: [], printKind: 'text', price: p.price, spec: p.spec ?? '' }
}

/**
 * Danh sách sản phẩm realtime. Firestore chưa có sản phẩm nào → dùng catalog mặc định trong bộ nhớ
 * (`isFallback`), để báo giá / đơn áo vẫn chạy được trước khi bấm "Tạo sản phẩm mặc định".
 */
export function useProducts() {
  const q = useMemo(() => productsQuery(), [])
  const { data, error } = useLiveQuery(q, toProduct)
  // Chưa có sản phẩm, hoặc không đọc được (VD rules chưa publish) → catalog mặc định, để form không treo
  const isFallback = error != null || (data != null && data.length === 0)
  const products = isFallback ? FALLBACK_PRODUCTS : data
  return { products, isFallback, loading: data == null && !error, error }
}

const stamp = () => ({ updatedAt: serverTimestamp(), updatedBy: currentEmail() })

export async function createProduct(content: ProductContent) {
  const ref = await addDoc(collection(db, COL.products), {
    ...productContentOf(content),
    // Không có ô "thứ tự" trên form: sản phẩm mới xếp sau các sản phẩm đã có
    sortOrder: Date.now(),
    createdAt: serverTimestamp(),
    createdBy: currentEmail(),
    ...stamp(),
  })
  return ref.id
}

export const saveProduct = (id: string, content: ProductContent) =>
  updateDoc(productRef(id), { ...productContentOf(content), ...stamp() })

export const setProductActive = (id: string, active: boolean) => updateDoc(productRef(id), { active, ...stamp() })

export const deleteProduct = (id: string) => deleteDoc(productRef(id))

/** Ghi 4 sản phẩm mặc định (ID cố định — bấm lại thì ghi đè, không nhân đôi) */
export async function createDefaultProducts() {
  const batch = writeBatch(db)
  for (const { id, ...content } of DEFAULT_CATALOG) {
    batch.set(productRef(id), { ...content, createdAt: serverTimestamp(), createdBy: currentEmail(), ...stamp() })
  }
  await batch.commit()
}
