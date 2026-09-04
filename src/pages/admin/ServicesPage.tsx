import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Save, Plus, Trash2 } from "lucide-react"

type Service = {
  id: string
  title: string
  description: string
  icon?: string
}

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadServices()
  }, [])

  const loadServices = async () => {
    try {
      const res = await fetch("/api/admin/content/services")
      const data = await res.json()
      setServices(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error("Failed to load services", e)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/content/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(services),
      })
      if (!res.ok) throw new Error("Failed to save")
      alert("Services saved successfully")
    } catch (e) {
      alert("Failed to save services")
    } finally {
      setSaving(false)
    }
  }

  const updateField = (index: number, field: keyof Service, value: string) => {
    setServices((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  const addService = () => {
    setServices((prev) => [...prev, { id: `service-${Date.now()}`, title: "", description: "", icon: "" }])
  }

  const removeService = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Services Management</h1>
        <p className="text-muted-foreground">Add, edit, or remove your company's services.</p>
      </div>
      <div className="grid gap-6">
        {services.map((service, index) => (
          <Card key={service.id}>
            <CardHeader>
              <CardTitle>Service {index + 1}</CardTitle>
              <CardDescription>Edit service details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={service.title} onChange={(e) => updateField(index, "title", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={service.description} onChange={(e) => updateField(index, "description", e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <Input value={service.icon || ""} onChange={(e) => updateField(index, "icon", e.target.value)} placeholder="lucide icon name" />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button variant="destructive" onClick={() => removeService(index)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button onClick={addService} variant="outline">
        <Plus className="mr-2 h-4 w-4" />
        Add Service
      </Button>
    </div>
  )
}
