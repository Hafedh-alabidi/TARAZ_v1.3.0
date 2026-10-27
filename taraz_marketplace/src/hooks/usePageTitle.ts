import { useEffect } from 'react'

/**
 * ✅ SEO: عنوان ووصف فريدان لكل صفحة — يحدّثان وسم <title> و meta description.
 * يستدعى مرة واحدة أعلى كل صفحة.
 */
export function usePageTitle(title: string, description?: string) {
  useEffect(() => {
    const prev = document.title
    document.title = title

    let meta: HTMLMetaElement | null = null
    if (description) {
      meta = document.querySelector('meta[name="description"]')
      if (meta) meta.setAttribute('content', description)
    }

    return () => {
      document.title = prev
      if (meta && description) {
        meta?.setAttribute('content', description)
      }
    }
  }, [title, description])
}
