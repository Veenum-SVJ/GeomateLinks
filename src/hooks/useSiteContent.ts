import { useEffect, useState } from "react"
import type { SiteContent } from "@/types/content"
import { fetchContent, fallbackContent } from "@/lib/api"

export function useSiteContent() {
  const [content, setContent] = useState<SiteContent>(fallbackContent)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    fetchContent()
      .then((data) => {
        if (active && data && typeof data === "object") setContent(data)
      })
      .catch(() => {
        /* keep bundled fallback */
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { content, loading }
}
