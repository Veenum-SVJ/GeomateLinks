import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Save } from "lucide-react"
import content from "@/data/content.json"

export default function AdminSettingsPage() {
  const [form, setForm] = useState({
    address: `${content.company.address.suite}, ${content.company.address.street}, ${content.company.address.city}, ${content.company.address.state}`,
    phone: content.company.phones.join(", "),
    email: content.company.emails.join(", "),
    hours: content.company.hours,
    facebook: content.company.facebook || "",
    twitter: "",
    linkedin: "",
  })
  const [saving, setSaving] = useState(false)

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error("Failed to save")
      alert("Settings saved successfully")
    } catch (e) {
      alert("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage website settings and contact information.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>Update your company's public contact details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => updateField("address", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => updateField("email", e.target.value)} type="email" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Working Hours</Label>
            <Input value={form.hours} onChange={(e) => updateField("hours", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Facebook URL</Label>
              <Input value={form.facebook} onChange={(e) => updateField("facebook", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Twitter/X URL</Label>
              <Input value={form.twitter} onChange={(e) => updateField("twitter", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>LinkedIn URL</Label>
              <Input value={form.linkedin} onChange={(e) => updateField("linkedin", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
