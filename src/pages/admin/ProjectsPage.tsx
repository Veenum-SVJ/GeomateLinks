import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Save, Plus, Trash2 } from "lucide-react"

type Project = {
  id: string
  title: string
  category: string
  location: string
  status: string
  image: string
  alt: string
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const res = await fetch("/api/admin/content/projects")
      const data = await res.json()
      setProjects(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error("Failed to load projects", e)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/content/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projects),
      })
      if (!res.ok) throw new Error("Failed to save")
      alert("Projects saved successfully")
    } catch (e) {
      alert("Failed to save projects")
    } finally {
      setSaving(false)
    }
  }

  const updateField = (index: number, field: keyof Project, value: string) => {
    setProjects((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  const addProject = () => {
    setProjects((prev) => [...prev, {
      id: `project-${Date.now()}`,
      title: "",
      category: "",
      location: "",
      status: "Completed",
      image: "/media/20250502_123302-800.jpg",
      alt: ""
    }])
  }

  const removeProject = (index: number) => {
    setProjects((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects Management</h1>
        <p className="text-muted-foreground">Manage your project gallery.</p>
      </div>
      <div className="grid gap-6">
        {projects.map((project, index) => (
          <Card key={project.id}>
            <CardHeader>
              <CardTitle>Project {index + 1}</CardTitle>
              <CardDescription>Edit project details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={project.title} onChange={(e) => updateField(index, "title", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input value={project.category} onChange={(e) => updateField(index, "category", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input value={project.location} onChange={(e) => updateField(index, "location", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Input value={project.status} onChange={(e) => updateField(index, "status", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input value={project.image} onChange={(e) => updateField(index, "image", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Alt Text</Label>
                <Textarea value={project.alt} onChange={(e) => updateField(index, "alt", e.target.value)} rows={2} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button variant="destructive" onClick={() => removeProject(index)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button onClick={addProject} variant="outline">
        <Plus className="mr-2 h-4 w-4" />
        Add Project
      </Button>
    </div>
  )
}
