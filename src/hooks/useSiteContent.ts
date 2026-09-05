import { useEffect, useState } from "react"
import type { SiteContent } from "@/types/content"
import { fetchContent, fallbackContent } from "@/lib/api"

export function useSiteContent() {
  const [content, setContent] = useState<SiteContent>(fallbackContent)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    fetchContent()
      .then(res => {
        if (active && res && typeof res === "object") setContent(res)
        setLoading(false)
      })
      .catch(() => {
        if (active) setLoading(false)
      })
  }, [])

  return { content, loading }
}