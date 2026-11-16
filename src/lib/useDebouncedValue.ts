import { useEffect, useState } from 'react'

/** Trả về `value` sau khi nó đứng yên `delay` ms — để không vẽ lại phần nặng mỗi lần gõ phím. */
export function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
