import { useMemo } from 'react'
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, writeBatch } from 'firebase/firestore'
import type { DocumentReference } from 'firebase/firestore'
import { readImageFile } from './file'
import { currentEmail, db, IMAGES } from './firebase'
import { toDate, useLiveQuery } from './firestoreHooks'

// Ảnh lưu thẳng trong Firestore (subcollection `images` dưới mỗi báo giá / đơn áo), mỗi ảnh 1 document,
// dạng data URL. Không dùng Cloud Storage vì bucket mới cần gói Blaze. Firestore: 1 document ≤ 1 MiB.
const MAX_CHARS = 900_000

export interface StoredImage {
  id: string
  /** Ảnh dùng vào việc gì: print (nội dung in báo giá), cell (ô mẫu câu), tag (in tag đơn áo), embroidery (thêu) */
  kind: string
  name: string
  src: string
  createdAt: Date | null
}

/** Ảnh đã chọn trong form tạo mới, chưa ghi lên Firestore (ghi khi bấm "Tạo") */
export interface PendingImage {
  id: string
  kind: string
  name: string
  src: string
}

const imagesOf = (parent: DocumentReference) => collection(parent, IMAGES)

/** Ảnh của 1 báo giá / đơn áo, lọc theo `kind`, realtime */
export function useImages(parent: DocumentReference | null, kind: string) {
  const q = useMemo(() => (parent ? query(imagesOf(parent), orderBy('createdAt')) : null), [parent])
  const { data, error } = useLiveQuery(q, (snap) => {
    const d = snap.data()
    return { id: snap.id, kind: d.kind, name: d.name ?? '', src: d.src, createdAt: toDate(d.createdAt) } as StoredImage
  })
  const images = useMemo(() => (data ?? []).filter((img) => img.kind === kind), [data, kind])
  return { images, loading: data == null && !error, error }
}

/** Đọc + nén ảnh cho vừa 1 document Firestore (dùng cho form tạo mới: giữ ảnh trên máy tới khi bấm "Tạo") */
export const readImageForFirestore = (file: File, maxSize: number) => readImageFile(file, maxSize, MAX_CHARS)

/** Ghi ảnh đã đọc sẵn (data URL) vào subcollection images */
export const addImageSrc = (parent: DocumentReference, kind: string, name: string, src: string) =>
  addDoc(imagesOf(parent), { kind, name, src, createdAt: serverTimestamp(), createdBy: currentEmail() })

export async function addImage(parent: DocumentReference, kind: string, file: File, maxSize: number) {
  await addImageSrc(parent, kind, file.name, await readImageForFirestore(file, maxSize))
}

export const removeImage = (parent: DocumentReference, id: string) => deleteDoc(doc(imagesOf(parent), id))

/** Xoá document cha kèm toàn bộ ảnh (Firestore không tự xoá subcollection) */
export async function deleteWithImages(parent: DocumentReference) {
  const snap = await getDocs(imagesOf(parent))
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(parent)
  await batch.commit()
}
