import { useEffect, useRef, useState } from "react"
import { upload } from "@vercel/blob/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { fetchMedia } from "@/lib/api"
import type { MediaItem } from "@/types/content"
import { UploadCloud, X, Film } from "lucide-react"

type Props = {
  value: string
  onChange: (url: string) => void
  label?: string
  accept?: string
}

export default function MediaField({ value, onChange, label = "Image", accept = "image/*,video/mp4" }: Props) {
  const [open, setOpen] = useState(false)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    fetchMedia()
      .then((res) => setMedia(res.media))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load media"))
  }, [open])

  const handleUpload = async (file: File) => {
    setBusy(true)
    setError("")
    try {
      const blob = await upload(`media/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
      })
      onChange(blob.url)
      const res = await fetchMedia()
      setMedia(res.media)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setBusy(false)
    }
  }

  const isVideo = value.endsWith(".mp4") || value.endsWith(".webm")

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex items-start gap-3">
        <div className="h-20 w-28 shrink-0 overflow-hidden rounded border border-border bg-muted">
          {value ? (
            isVideo ? (
              <div className="flex h-full w-full items-center justify-center">
                <Film className="h-6 w-6 text-muted-foreground" />
              </div>
            ) : (
              <img src={value} alt="" className="h-full w-full object-cover" />
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">None</div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="/media/photo.jpg or https://…" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
              <UploadCloud className="mr-2 h-4 w-4" />
              {busy ? "Uploading…" : "Upload new"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen((prev) => !prev)}>
              {open ? "Hide library" : "Choose from library"}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                <X className="mr-1 h-4 w-4" /> Clear
              </Button>
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) handleUpload(file)
          event.target.value = ""
        }}
      />

      {open && (
        <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto rounded border border-border bg-card p-2 sm:grid-cols-5">
          {media.length === 0 && <p className="col-span-full p-3 text-xs text-muted-foreground">Library is empty. Upload a file to get started.</p>}
          {media.map((item) => (
            <button
              key={item.url}
              type="button"
              onClick={() => {
                onChange(item.url)
                setOpen(false)
              }}
              className="group overflow-hidden rounded border border-border"
              title={item.pathname}
            >
              {item.pathname.endsWith(".mp4") ? (
                <div className="flex aspect-square items-center justify-center bg-muted">
                  <Film className="h-5 w-5 text-muted-foreground" />
                </div>
              ) : (
                <img src={item.url} alt={item.pathname} className="aspect-square w-full object-cover transition group-hover:opacity-80" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
