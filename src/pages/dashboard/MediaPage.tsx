"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { UploadCloud } from "lucide-react"

export default function MediaPage() {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

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

    xhr.open("POST", "/api/upload")
    xhr.send(formData)
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Media Library</h1>
        <p className="text-muted-foreground">Upload and manage images, videos, and other documents.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Your Files</CardTitle>
            <CardDescription>Manage your uploaded media assets.</CardDescription>
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
          />
        </CardHeader>
        <CardContent className="text-center py-12">
          {uploading ? (
            <div className="max-w-md mx-auto">
              <Progress value={uploadProgress} className="w-full" />
              <p className="mt-2 text-sm text-muted-foreground">Please wait while your file is being uploaded.</p>
            </div>
          ) : (
            <>
              <p className="text-muted-foreground">Your media library is ready for uploads.</p>
              <p className="text-sm text-muted-foreground">Upload images and videos for the website.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
