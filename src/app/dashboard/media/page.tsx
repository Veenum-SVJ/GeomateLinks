"use client";

import { useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud } from "lucide-react";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export default function MediaPage() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleUpload = (file: File) => {
    const storageRef = ref(storage, `media/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    setUploading(true);
    setUploadProgress(0);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        setUploading(false);
        toast({
          title: "Upload Failed",
          description: error.message,
          variant: "destructive",
        });
      },
      () => {
        setUploading(false);
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          console.log('File available at', downloadURL);
          toast({
            title: "Upload Successful",
            description: "Your file has been uploaded.",
          });
          // Here you would typically save the downloadURL to a database
        });
      }
    );
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  }

  return (
     <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Media Library</h1>
        <p className="text-muted-foreground">
          Upload and manage images, PDFs, and other documents.
        </p>
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
              <p className="text-muted-foreground">Your media library is empty.</p>
              <p className="text-sm text-muted-foreground">Start by uploading your first file.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}