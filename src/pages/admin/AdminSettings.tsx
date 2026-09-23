import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAdmin } from "@/lib/adminStore"
import type { Company } from "@/types/content"

export default function AdminSettings() {
  const { content, loading, update } = useAdmin()

  if (loading || !content) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-brown border-t-transparent" />
      </div>
    )
  }

  const setCompany = (fn: (company: Company) => void) =>
    update((draft) => {
      fn(draft.company)
      return draft
    })

  const field = (key: keyof Company, label: string, id?: string) => (
    <div className="space-y-2">
      <Label htmlFor={id || `company-${key}`}>{label}</Label>
      <Input
        id={id || `company-${key}`}
        value={String(content.company[key] ?? "")}
        onChange={(e) => setCompany((c) => { (c[key] as string) = e.target.value })}
      />
    </div>
  )

  const listField = (key: "phones" | "emails", label: string) => (
    <div className="space-y-2">
      <Label htmlFor={`company-${key}`}>{label} (one per line)</Label>
      <Textarea
        id={`company-${key}`}
        rows={2}
        value={content.company[key].join("\n")}
        onChange={(e) =>
          setCompany((c) => {
            c[key] = e.target.value.split("\n").map((line) => line.trim()).filter(Boolean)
          })
        }
      />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Company details shown across the site. Publish when done.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>Names and strapline used in the header, footer and About band.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {field("name", "Full company name")}
          {field("shortName", "Short name")}
          {field("discipline", "Discipline strapline")}
          {field("hours", "Office hours")}
          {field("established", "Established")}
          {field("rcNumber", "RC number")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About copy</CardTitle>
          <CardDescription>The paragraphs shown in the About section.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-mission">Mission</Label>
            <Textarea id="company-mission" rows={2} value={content.company.mission} onChange={(e) => setCompany((c) => { c.mission = e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-corp">Corporate information</Label>
            <Textarea id="company-corp" rows={3} value={content.company.corporateInfo} onChange={(e) => setCompany((c) => { c.corporateInfo = e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-legal">Legal structure</Label>
            <Textarea id="company-legal" rows={2} value={content.company.legalStructure} onChange={(e) => setCompany((c) => { c.legalStructure = e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-hr">Human resources</Label>
            <Textarea id="company-hr" rows={2} value={content.company.humanResources} onChange={(e) => setCompany((c) => { c.humanResources = e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact details</CardTitle>
          <CardDescription>Shown in the Contact section and footer.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {listField("phones", "Phone numbers")}
          {listField("emails", "Email addresses")}
          {field("website", "Website")}
          {field("facebook", "Facebook URL")}
          <div className="space-y-2 sm:col-span-2">
            <Label>Address</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                placeholder="Suite"
                value={content.company.address.suite}
                onChange={(e) => setCompany((c) => { c.address.suite = e.target.value })}
              />
              <Input
                placeholder="Street"
                value={content.company.address.street}
                onChange={(e) => setCompany((c) => { c.address.street = e.target.value })}
              />
              <Input
                placeholder="City"
                value={content.company.address.city}
                onChange={(e) => setCompany((c) => { c.address.city = e.target.value })}
              />
              <Input
                placeholder="State"
                value={content.company.address.state}
                onChange={(e) => setCompany((c) => { c.address.state = e.target.value })}
              />
              <Input
                placeholder="Country"
                value={content.company.address.country}
                onChange={(e) => setCompany((c) => { c.address.country = e.target.value })}
              />
              <Input
                placeholder="Postal code"
                value={content.company.address.postal}
                onChange={(e) => setCompany((c) => { c.address.postal = e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Map</CardTitle>
          <CardDescription>The Google Maps embed and fallback link in the Contact section.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {field("mapEmbed", "Embed URL")}
          {field("mapLink", "Fallback link (Open in Google Maps)")}
        </CardContent>
      </Card>
    </div>
  )
}
