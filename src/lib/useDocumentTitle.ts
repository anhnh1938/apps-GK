import { useEffect } from 'react'

export const APP_NAME = 'Góc Kể Studio'

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`
  }, [title])
}
