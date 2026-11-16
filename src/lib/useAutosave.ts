import { useEffect, useRef, useState } from 'react'

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

/**
 * Tự lưu `value` (`delay` ms sau lần đổi cuối) bằng `save`. Giá trị ban đầu coi như đã lưu.
 * Rời trang khi còn thay đổi chưa lưu thì lưu nốt. So sánh theo tham chiếu: chỉ tạo object mới khi thật sự đổi.
 * `enabled: false` (form tạo mới chưa bấm "Tạo") thì không lưu gì.
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  { delay = 800, enabled = true }: { delay?: number; enabled?: boolean } = {},
) {
  const [saved, setSaved] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const latest = useRef({ value, saved, save, enabled })

  useEffect(() => {
    latest.current = { value, saved, save, enabled }
  })

  useEffect(() => {
    if (!enabled || value === saved) return
    const timer = setTimeout(() => {
      setSaving(true)
      latest.current
        .save(value)
        .then(
          () => {
            setSaved(value)
            setSavedAt(new Date())
            setError(null)
          },
          (err: unknown) => {
            console.error(err)
            setError(err)
          },
        )
        .finally(() => setSaving(false))
    }, delay)
    return () => clearTimeout(timer)
  }, [value, saved, delay, enabled])

  // Rời trang (đổi route) khi còn thay đổi chưa lưu → lưu nốt
  useEffect(
    () => () => {
      const { value: v, saved: s, save: fn, enabled: on } = latest.current
      if (on && v !== s) fn(v).catch(console.error)
    },
    [],
  )

  const status: SaveStatus = error ? 'error' : saving ? 'saving' : value !== saved ? 'pending' : 'saved'
  return { status, savedAt, error }
}
