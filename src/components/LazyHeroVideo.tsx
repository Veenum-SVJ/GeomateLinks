import { useEffect, useRef, useState } from "react"

type Props = { src: string; poster?: string; alt?: string }

/**
 * Hero video that only mounts — and therefore only starts loading — once it
 * is actually in or near the viewport, and pauses whenever it scrolls out.
 * Until it mounts, the poster image holds the identical aspect-ratio box,
 * so the swap causes no layout shift.
 */
export default function LazyHeroVideo({ src, poster, alt = "" }: Props) {
  const holder = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = holder.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        setVisible(entry.isIntersecting)
        if (entry.isIntersecting) setMounted(true)
      },
      { rootMargin: "200px 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Play while visible, pause when scrolled away (battery/CPU friendly).
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (visible) {
      video.play().catch(() => {
        /* autoplay policies can reject; the muted loop retries on visibility */
      })
    } else {
      video.pause()
    }
  }, [visible, mounted])

  return (
    <div ref={holder}>
      {mounted ? (
        <video
          ref={videoRef}
          loop
          muted
          playsInline
          preload="auto"
          poster={poster}
        >
          <source src={src} type="video/mp4" />
        </video>
      ) : (
        <img src={poster} alt={alt} />
      )}
    </div>
  )
}
