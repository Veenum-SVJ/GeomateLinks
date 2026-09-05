import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

interface MediaItem {
  filename?: string;
  type?: string;
  url?: string;
}

export default function AdminMedia() {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/admin/media')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMedia(data)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setUploading(true)
    try {
      const res = await fetch('/api/admin/media/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })
      if (res.ok) {
        setUploadSuccess(true)
        // Refresh media list
        const mediaRes = await fetch('/api/admin/media')
        const mediaData = await mediaRes.json()
        if (Array.isArray(mediaData)) {
          setMedia(mediaData)
        }
        setTimeout(() => setUploadSuccess(false), 2000)
      }
    } catch (err) {
      console.error('Upload failed:', err)
    }
    setUploading(false)
  }

  const handleDelete = async (filename: string) => {
    try {
      await fetch(`/api/admin/media/${filename}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      setMedia(media.filter(m => m.filename !== filename))
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-brown border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Media Library</h1>
        <p className="text-sm text-muted-foreground">Upload and manage images and videos.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Media</CardTitle>
          <CardDescription>Upload images and videos for the website.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <input
              type="file"
              accept="image/*,video/mp4"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-brown file:text-white file:hover:bg-brand-brown/90 cursor-pointer"
            />
            {uploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
            {uploadSuccess && <p className="text-sm text-green-600">Upload successful!</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Media Library</CardTitle>
          <CardDescription>{media.length} files uploaded</CardDescription>
        </CardHeader>
        <CardContent>
          {media.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No media files yet</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {media.map((item) => (
                <div key={item.filename} className="border rounded-lg overflow-hidden">
                  {item.type?.startsWith('image/') ? (
                    <img src={item.url} alt={item.filename} className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-muted flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">Video</span>
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-xs truncate">{item.filename}</p>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full mt-1"
                      onClick={() => handleDelete(item.filename!)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}