import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload } from "lucide-react"

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects Management</h1>
        <p className="text-muted-foreground">Manage your project gallery here.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Project Gallery</CardTitle>
            <CardDescription>Upload images with titles, categories, and descriptions.</CardDescription>
          </div>
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload Project
          </Button>
        </CardHeader>
        <CardContent className="text-center py-12">
          <p className="text-muted-foreground">Your project gallery is empty.</p>
          <p className="text-sm text-muted-foreground">Start by uploading your first project.</p>
        </CardContent>
      </Card>
    </div>
  )
}
