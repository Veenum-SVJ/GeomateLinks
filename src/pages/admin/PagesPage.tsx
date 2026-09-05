import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export default function PagesPage() {
  const [content, setContent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/content')
      .then(res => res.json())
      .then(data => {
        setContent(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!content) return
    setSaving(true)
    try {
      await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(content)
      })
      alert('Content saved!')
    } catch (err) {
      console.error('Save failed:', err)
      alert('Failed to save content')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-brown border-t-transparent" />
      </div>
    )
  }

  if (!content) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No content found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pages Management</h1>
        <p className="text-sm text-muted-foreground">Edit website pages and content.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About Section</CardTitle>
          <CardDescription>Edit the content for the about section of your website.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            rows={10}
            value={content.about?.description || ""}
            onChange={(e) => setContent({ ...content, about: { ...content.about, description: e.target.value } })}
            className="w-full"
          />
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}