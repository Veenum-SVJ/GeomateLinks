import { useEffect } from "react"
import { useLocation } from "react-router-dom"

type PageConfig = {
  title: string
  description: string
  url: string
  noindex?: boolean
}

const SITE = "https://geomate-links.vercel.app"

const pages: Record<string, PageConfig> = {
  "/": {
    title: "Geomate Links Consulting Limited — Surveying, Mapping & GIS, Ibadan",
    description:
      "Geomate Links Consulting Limited (RC746106) provides cadastral, engineering, topographic, bathymetric and UAV survey, mapping, digitization and GIS/LIS services from Ibadan, Oyo State, Nigeria.",
    url: `${SITE}/`,
  },
}

function upsertMeta(selector: string, attr: "name" | "property", key: string, value: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector)
  if (!tag) {
    tag = document.createElement("meta")
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute("content", value)
}

export default function useSEO() {
  const location = useLocation()

  useEffect(() => {
    const path = location.pathname || "/"
    const isAdmin = path.startsWith("/admin")

    const config: PageConfig = isAdmin
      ? {
          title: "Admin — Geomate Links Consulting",
          description: "Private content management area.",
          url: `${SITE}${path}`,
          noindex: true,
        }
      : pages[path] ?? pages["/"]

    document.title = config.title
    upsertMeta('meta[name="description"]', "name", "description", config.description)
    upsertMeta('meta[name="robots"]', "name", "robots", config.noindex ? "noindex, nofollow" : "index, follow")
    upsertMeta('meta[property="og:title"]', "property", "og:title", config.title)
    upsertMeta('meta[property="og:description"]', "property", "og:description", config.description)
    upsertMeta('meta[property="og:url"]', "property", "og:url", config.url)
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", config.title)
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", config.description)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement("link")
      canonical.rel = "canonical"
      document.head.appendChild(canonical)
    }
    canonical.href = config.url
  }, [location.pathname])
}
