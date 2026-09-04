import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Save } from "lucide-react"

type Page = {
  id: string
  title: string
  content: string
}

export default function AdminPagesPage() {
  const [pages, setPages] = useState<Page[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadPages()
  }, [])

  const loadPages = async () => {
    try {
      const res = await fetch("/api/admin/content/pages")
      const data = await res.json()
      setPages(Object.entries(data).map(([id, page]: [string, any]) => ({ id, ...page })))
    } catch (e) {
      console.error("Failed to load pages", e)
    }
  }

  const handleSave = async (page: Page) => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/content/pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(page),
      })
      if (!res.ok) throw new Error("Failed to save")
      alert("Page saved successfully")
    } catch (e) {
      alert("Failed to save page")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pages Management</h1>
        <p className="text-muted-foreground">Edit website pages and content.</p>
      </div>
      <div className="grid gap-6">
        {pages.map((page) => (
          <Card key={page.id}>
            <CardHeader>
              <CardTitle>{page.title || page.id}</CardTitle>
              <CardDescription>Edit the content for this page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`title-${page.id}`}>Page Title</Label>
                <Input id={`title-${page.id}`} defaultValue={page.title} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`content-${page.id}`}>Content</Label>
                <Textarea id={`content-${page.id}`} rows={6} defaultValue={page.content} placeholder="Enter page content..." />
              </div>
              <Button onClick={() => handleSave(page)} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
