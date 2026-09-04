import { useEffect, useRef, useState } from "react"
import { upload } from "@vercel/blob/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { fetchMedia, deleteMedia } from "@/lib/api"
import type { MediaItem } from "@/types/content"
import { UploadCloud, Trash2, Film, Copy } from "lucide-react"

export default function AdminMedia() {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    fetchMedia()
      .then((res) => setMedia(res.media))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load media"))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleFiles = async (files: FileList) => {
    setBusy(true)
    setError("")
    setNotice("")
    try {
      for (const file of Array.from(files)) {
        setProgress(0)
        await upload(`media/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/admin/upload",
          onUploadProgress: ({ percentage }) => setProgress(percentage),
        })
      }
      setNotice("Upload complete.")
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setBusy(false)
      setProgress(0)
    }
  }

  const remove = async (url: string) => {
    if (!window.confirm("Delete this file permanently?")) return
    try {
      await deleteMedia(url)
      setMedia((prev) => prev.filter((item) => item.url !== url))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Media library</h1>
        <p className="text-sm text-muted-foreground">Images and videos stored in Vercel Blob. Upload once, reuse anywhere.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Upload files</CardTitle>
            <CardDescription>JPG, PNG, WebP, SVG, MP4, WebM or PDF up to 100 MB.</CardDescription>
          </div>
          <Button onClick={() => inputRef.current?.click()} disabled={busy}>
            <UploadCloud className="mr-2 h-4 w-4" />
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </CardHeader>
        {(busy || error || notice) && (
          <CardContent className="space-y-2">
            {busy && <Progress value={progress} />}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {notice && !error && <p className="text-sm text-success">{notice}</p>}
          </CardContent>
        )}
      </Card>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*,video/mp4,video/webm,application/pdf"
        onChange={(event) => {
          if (event.target.files?.length) handleFiles(event.target.files)
          event.target.value = ""
        }}
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading library…</p>
      ) : media.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Library is empty. Upload your first file above.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {media.map((item) => (
            <Card key={item.url} className="overflow-hidden">
              <div className="aspect-video bg-muted">
                {item.pathname.endsWith(".mp4") || item.pathname.endsWith(".webm") ? (
                  <div className="flex h-full items-center justify-center">
                    <Film className="h-8 w-8 text-muted-foreground" />
                  </div>
                ) : (
                  <img src={item.url} alt={item.pathname} className="h-full w-full object-cover" loading="lazy" />
                )}
              </div>
              <CardContent className="space-y-2 p-3">
                <p className="truncate text-xs font-medium" title={item.pathname}>
                  {item.pathname.replace(/^media\//, "")}
                </p>
                <p className="text-xs text-muted-foreground">{formatSize(item.size)}</p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      navigator.clipboard.writeText(item.url)
                      setNotice("URL copied to clipboard.")
                    }}
                  >
                    <Copy className="mr-1 h-3 w-3" /> Copy URL
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(item.url)} aria-label="Delete file">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
