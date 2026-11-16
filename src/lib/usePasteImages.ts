import { useEffect } from 'react'

/** Dán ảnh (Ctrl+V) ở bất kỳ đâu trên trang → `onFiles`. Dán chữ không bị ảnh hưởng. `onFiles` nên ổn định (useCallback). */
export function usePasteImages(onFiles: (files: File[]) => void) {
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      if (!files.length) return
      e.preventDefault()
      onFiles(files)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [onFiles])
}
