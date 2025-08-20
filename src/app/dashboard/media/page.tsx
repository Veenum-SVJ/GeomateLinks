import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud } from "lucide-react";

export default function MediaPage() {
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
            <Button>
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload File
            </Button>
        </CardHeader>
        <CardContent className="text-center py-12">
          <p className="text-muted-foreground">Your media library is empty.</p>
          <p className="text-sm text-muted-foreground">Start by uploading your first file.</p>
        </CardContent>
      </Card>
    </div>
  );
}
