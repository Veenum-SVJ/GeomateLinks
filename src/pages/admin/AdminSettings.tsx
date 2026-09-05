import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useState, useEffect } from "react"

interface CompanyData {
  name?: string;
  contact?: {
    email?: string;
    phone?: string;
    address?: string;
  };
}

interface ContentData {
  company?: CompanyData;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<ContentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/admin/content')
      .then(res => res.json())
      .then(data => {
        setSettings(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleChange = (section: string, field: string, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [section]: {
        ...settings[section as keyof ContentData],
        [field]: value
      }
    })
  }

  const handleSave = async () => {
    try {
      await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings)
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Save failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-brown border-t-transparent" />
      </div>
    )
  }

  const company = settings?.company || {}
  const contact = company.contact || {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage website settings and contact information.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>Edit your company details and contact information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={company.name || ""}
              onChange={(e) => handleChange('company', 'name', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={contact.email || ""}
              onChange={(e) => handleChange('company', 'contact', { ...contact, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={contact.phone || ""}
              onChange={(e) => handleChange('company', 'contact', { ...contact, phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={contact.address || ""}
              onChange={(e) => handleChange('company', 'contact', { ...contact, address: e.target.value })}
              rows={3}
            />
          </div>
          <Button onClick={handleSave} className={saved ? "bg-green-600 hover:bg-green-700" : ""}>
            {saved ? "Saved!" : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}