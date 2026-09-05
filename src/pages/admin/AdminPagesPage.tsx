import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"

export default function AdminPagesPage() {
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/admin/content')
      .then(res => res.json())
      .then(data => {
        setContent(JSON.stringify(data, null, 2))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    try {
      await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(JSON.parse(content))
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Save failed:', err)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pages Management</h1>
        <p className="text-sm text-muted-foreground">Edit website pages and content.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Website Content</CardTitle>
          <CardDescription>Edit the JSON configuration for your website content.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-brown border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="content">Content (JSON)</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={20}
                  className="font-mono text-xs"
                />
              </div>
              <Button 
                onClick={handleSave} 
                className={saved ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {saved ? "Saved!" : "Save Changes"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}