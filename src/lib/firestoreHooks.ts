import { useEffect, useRef, useState } from 'react'
import { getDoc, onSnapshot } from 'firebase/firestore'
import type { DocumentReference, DocumentSnapshot, Query, QueryDocumentSnapshot, Timestamp } from 'firebase/firestore'

/** Timestamp Firestore → Date (serverTimestamp chưa ghi xong thì là null) */
export const toDate = (v: unknown): Date | null =>
  v && typeof (v as Timestamp).toDate === 'function' ? (v as Timestamp).toDate() : null

/** Giữ hàm mới nhất trong ref — để hook không đăng ký lại khi caller truyền hàm inline */
function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}

/** Danh sách realtime (onSnapshot). `q` phải ổn định (useMemo), nếu không sẽ đăng ký lại mỗi lần render. */
export function useLiveQuery<T>(q: Query | null, map: (snap: QueryDocumentSnapshot) => T) {
  const [state, setState] = useState<{ data: T[] | null; error: Error | null }>({ data: null, error: null })
  const mapRef = useLatest(map)
  useEffect(() => {
    if (!q) return
    return onSnapshot(
      q,
      (snap) => setState({ data: snap.docs.map((d) => mapRef.current(d)), error: null }),
      (error) => setState({ data: null, error }),
    )
  }, [q, mapRef])
  return state
}

/** Đọc 1 document một lần (trang sửa: tải xong thì sửa local + tự lưu). `ref` phải ổn định (useMemo). */
export function useDocOnce<T>(ref: DocumentReference | null, map: (snap: DocumentSnapshot) => T) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; notFound: boolean; error: Error | null }>({
    data: null,
    loading: true,
    notFound: false,
    error: null,
  })
  const mapRef = useLatest(map)
  useEffect(() => {
    if (!ref) return
    let alive = true
    getDoc(ref).then(
      (snap) =>
        alive &&
        setState({ data: snap.exists() ? mapRef.current(snap) : null, loading: false, notFound: !snap.exists(), error: null }),
      (error: Error) => alive && setState({ data: null, loading: false, notFound: false, error }),
    )
    return () => {
      alive = false
    }
  }, [ref, mapRef])
  return state
}

/** Câu báo lỗi Firestore dễ hiểu cho người dùng */
export function firestoreErrorText(error: unknown) {
  const code = (error as { code?: string })?.code
  if (code === 'permission-denied')
    return 'Không có quyền truy cập dữ liệu. Kiểm tra Firestore rules đã publish và email đã có trong gk_members.'
  if (code === 'unavailable') return 'Không kết nối được Firebase. Kiểm tra mạng.'
  return `Lỗi Firebase${code ? ` (${code})` : ''}: ${(error as Error)?.message ?? String(error)}`
}
