"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { UploadCloud, Film } from "lucide-react"

type MediaItem = {
  name: string
  url: string
  size: number
}

export default function AdminMediaPage() {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [media, setMedia] = useState<MediaItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadMedia()
  }, [])

  const loadMedia = async () => {
    try {
      const res = await fetch("/api/admin/media/list")
      const data = await res.json()
      setMedia(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error("Failed to load media", e)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleUpload(file)
    }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    formData.append("file", file)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100
        setUploadProgress(progress)
      }
    })

    xhr.addEventListener("load", () => {
      setUploading(false)
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText)
        void response
        toast({
          title: "Upload Successful",
          description: "Your file has been uploaded.",
        })
        loadMedia()
      } else {
        const errorResponse = JSON.parse(xhr.responseText)
        toast({
          title: "Upload Failed",
          description: errorResponse.error || "An unknown error occurred.",
          variant: "destructive",
        })
      }
    })

    xhr.addEventListener("error", () => {
      setUploading(false)
      toast({
        title: "Upload Failed",
        description: "A network error occurred during the upload.",
        variant: "destructive",
      })
    })

    xhr.open("POST", "/api/admin/media/upload")
    xhr.send(formData)
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Media Library</h1>
        <p className="text-muted-foreground">Upload and manage images, videos, and documents.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Upload Media</CardTitle>
            <CardDescription>Upload images and videos for the website.</CardDescription>
          </div>
          <Button onClick={triggerFileSelect} disabled={uploading}>
            <UploadCloud className="mr-2 h-4 w-4" />
            {uploading ? `Uploading... ${Math.round(uploadProgress)}%` : "Upload File"}
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/mp4"
          />
        </CardHeader>
        {uploading && (
          <CardContent>
            <Progress value={uploadProgress} className="w-full" />
            <p className="mt-2 text-sm text-muted-foreground">Please wait while your file is being uploaded.</p>
          </CardContent>
        )}
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {media.map((item) => (
          <Card key={item.name} className="overflow-hidden">
            <div className="aspect-square bg-muted flex items-center justify-center">
              {item.name.endsWith(".mp4") ? (
                <Film className="h-12 w-12 text-brand-warm-gray" />
              ) : (
                <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
              )}
            </div>
            <CardContent className="p-3">
              <p className="text-xs font-medium truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">{formatSize(item.size)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
