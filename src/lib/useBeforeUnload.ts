import { useEffect } from 'react'

/** Đóng tab / tải lại trang khi `active` (VD form tạo mới chưa bấm "Tạo") → trình duyệt hỏi xác nhận */
export function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [active])
}
