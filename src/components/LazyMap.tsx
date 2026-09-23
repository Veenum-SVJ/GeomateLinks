import { useEffect, useRef, useState } from "react"
import { MapPin, Navigation, Phone } from "lucide-react"
import type { Company } from "@/types/content"

type Props = { company: Company }

type MapState = "idle" | "loading" | "ready" | "failed"

/**
 * Contact map that only mounts the Google embed once it scrolls into view,
 * and swaps to a styled address card (with a working maps link) if the
 * frame cannot load — e.g. blocked network, embed error, or an ad-blocker.
 */
export default function LazyMap({ company }: Props) {
  const holder = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<MapState>("idle")

  // Mount the iframe only when the placeholder approaches the viewport.
  useEffect(() => {
    const node = holder.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState((s) => (s === "idle" ? "loading" : s))
          observer.disconnect()
        }
      },
      { rootMargin: "300px 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // If the frame never reports a successful load, fall back to the card.
  useEffect(() => {
    if (state !== "loading") return
    const timer = window.setTimeout(() => {
      setState((s) => (s === "loading" ? "failed" : s))
    }, 10000)
    return () => window.clearTimeout(timer)
  }, [state])

  const showEmbed = state === "loading" || state === "ready"

  return (
    <div className="contact-map-wrap">
      <div className="contact-map" ref={holder}>
        {showEmbed && (
          <iframe
            src={company.mapEmbed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Geomate Links office location on Google Maps"
            onLoad={() => setState((s) => (s === "loading" ? "ready" : s))}
            onError={() => setState("failed")}
          />
        )}
        {state === "loading" && (
          <div className="map-skeleton" aria-hidden>
            <span className="map-skeleton-spinner" />
            <span className="map-skeleton-label">Loading map…</span>
          </div>
        )}
        {state === "failed" && (
          <div className="map-fallback" role="group" aria-label="Office address and directions">
            <span className="map-fallback-badge">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              Find us
            </span>
            <h4>Geomate Links Consulting Ltd</h4>
            <p className="map-fallback-address">
              {company.address.suite}, {company.address.street},<br />
              {company.address.city}, {company.address.state}
            </p>
            <div className="map-fallback-actions">
              <a href={company.mapLink} target="_blank" rel="noreferrer">
                <Navigation className="h-3.5 w-3.5" aria-hidden />
                Get directions
              </a>
              {company.phones?.[0] && (
                <a href={`tel:${company.phones[0].replace(/\s+/g, "")}`}>
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  {company.phones[0]}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
      <a className="contact-map-link" href={company.mapLink} target="_blank" rel="noreferrer">
        Open in Google Maps →
      </a>
    </div>
  )
}
