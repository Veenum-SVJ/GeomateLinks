import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useCallback, useEffect, useRef, useState } from "react"
import { fetchMedia, deleteMedia } from "@/lib/api"
import type { MediaItem } from "@/types/content"
import { Film, Copy, Check, Trash2, UploadCloud, RefreshCw } from "lucide-react"

export default function AdminMedia() {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setError("")
    try {
      const res = await fetchMedia()
      setMedia(res.media ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleUpload = async (files: File[]) => {
    if (!files.length) return
    setUploading(true)
    setError("")
    try {
      const { upload } = await import("@vercel/blob/client")
      for (const file of files) {
        await upload(`media/${Date.now()}-${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/admin/upload",
        })
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (item: MediaItem) => {
    if (!window.confirm(`Delete ${item.pathname}? This cannot be undone.`)) return
    setError("")
    try {
      await deleteMedia(item.url)
      setMedia((prev) => prev.filter((m) => m.url !== item.url))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    }
  }

  const copyUrl = async (item: MediaItem) => {
    try {
      await navigator.clipboard.writeText(item.url)
      setCopied(item.url)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      setError("Could not copy the URL")
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Media</h1>
          <p className="text-sm text-muted-foreground">Images and video stored in Blob storage, ready to use across the site.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
            <UploadCloud className="mr-2 h-4 w-4" /> {uploading ? "Uploading…" : "Upload files"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/mp4"
        multiple
        className="hidden"
        onChange={(e) => {
          // Copy the files out first: resetting the input wipes the live
          // FileList, which would leave the async uploader nothing to send.
          const files = e.target.files ? Array.from(e.target.files) : []
          e.target.value = ""
          if (files.length) handleUpload(files)
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Library ({media.length} file{media.length === 1 ? "" : "s"})</CardTitle>
          <CardDescription>Copy a file's URL to use it anywhere in the editors, or pick uploads directly from Projects.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-brown border-t-transparent" />
            </div>
          ) : media.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No media yet. Upload your first image or video.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {media.map((item) => {
                const isVideo = /\.(mp4|webm)$/i.test(item.pathname)
                return (
                  <div key={item.url} className="overflow-hidden rounded-lg border bg-white">
                    <div className="h-32 w-full bg-muted">
                      {isVideo ? (
                        <div className="flex h-full w-full items-center justify-center">
                          <Film className="h-6 w-6 text-muted-foreground" />
                        </div>
                      ) : (
                        <img src={item.url} alt={item.pathname} className="h-full w-full object-cover" loading="lazy" />
                      )}
                    </div>
                    <div className="space-y-1 p-2">
                      <p className="truncate text-xs font-medium" title={item.pathname}>{item.pathname.replace(/^media\//, "")}</p>
                      <p className="text-[10px] text-muted-foreground">{formatSize(item.size)}</p>
                      <div className="flex gap-1 pt-1">
                        <Button variant="outline" size="sm" className="h-7 flex-1 px-2 text-xs" onClick={() => copyUrl(item)}>
                          {copied === item.url ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                          {copied === item.url ? "Copied" : "Copy URL"}
                        </Button>
                      </div>
                      <Button variant="destructive" size="sm" className="h-7 w-full text-xs" onClick={() => handleDelete(item)}>
                        <Trash2 className="mr-1 h-3 w-3" /> Delete
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
