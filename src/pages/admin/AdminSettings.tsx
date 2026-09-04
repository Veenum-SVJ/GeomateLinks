import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAdmin } from "@/lib/adminStore"

export default function AdminSettings() {
  const { content, update } = useAdmin()
  if (!content) return null

  const company = content.company

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Company & contact</h1>
        <p className="text-sm text-muted-foreground">Details shown in the contact section, footer and structured data.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>Company name and registration.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Registered name</Label>
            <Input
              value={company.name}
              onChange={(e) =>
                update((d) => {
                  d.company.name = e.target.value
                  return d
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Short name</Label>
            <Input
              value={company.shortName}
              onChange={(e) =>
                update((d) => {
                  d.company.shortName = e.target.value
                  return d
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>RC number</Label>
            <Input
              value={company.rcNumber}
              onChange={(e) =>
                update((d) => {
                  d.company.rcNumber = e.target.value
                  return d
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Established</Label>
            <Input
              value={company.established}
              onChange={(e) =>
                update((d) => {
                  d.company.established = e.target.value
                  return d
                })
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Mission statement</Label>
            <Textarea
              rows={2}
              value={company.mission}
              onChange={(e) =>
                update((d) => {
                  d.company.mission = e.target.value
                  return d
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
          <CardDescription>Used in the contact rows and local business schema.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {(["suite", "street", "city", "state", "country", "postal"] as const).map((field) => (
            <div className="space-y-2" key={field}>
              <Label className="capitalize">{field}</Label>
              <Input
                value={company.address[field]}
                onChange={(e) =>
                  update((d) => {
                    d.company.address[field] = e.target.value
                    return d
                  })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact channels</CardTitle>
          <CardDescription>One phone or email per line.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Phone numbers</Label>
            <Textarea
              rows={2}
              value={company.phones.join("\n")}
              onChange={(e) =>
                update((d) => {
                  d.company.phones = e.target.value.split("\n").map((v) => v.trim()).filter(Boolean)
                  return d
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Email addresses</Label>
            <Textarea
              rows={2}
              value={company.emails.join("\n")}
              onChange={(e) =>
                update((d) => {
                  d.company.emails = e.target.value.split("\n").map((v) => v.trim()).filter(Boolean)
                  return d
                })
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Working hours</Label>
              <Input
                value={company.hours}
                onChange={(e) =>
                  update((d) => {
                    d.company.hours = e.target.value
                    return d
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Facebook URL</Label>
              <Input
                value={company.facebook}
                onChange={(e) =>
                  update((d) => {
                    d.company.facebook = e.target.value
                    return d
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Map</CardTitle>
          <CardDescription>Embed URL powers the map frame; link opens Google Maps.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Map embed URL</Label>
            <Input
              value={company.mapEmbed}
              onChange={(e) =>
                update((d) => {
                  d.company.mapEmbed = e.target.value
                  return d
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Map link</Label>
            <Input
              value={company.mapLink}
              onChange={(e) =>
                update((d) => {
                  d.company.mapLink = e.target.value
                  return d
                })
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Latitude</Label>
              <Input
                value={String(company.coordinates.lat)}
                onChange={(e) =>
                  update((d) => {
                    d.company.coordinates.lat = Number(e.target.value) || 0
                    return d
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Longitude</Label>
              <Input
                value={String(company.coordinates.lon)}
                onChange={(e) =>
                  update((d) => {
                    d.company.coordinates.lon = Number(e.target.value) || 0
                    return d
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact section copy</CardTitle>
          <CardDescription>Heading shown above the contact details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={content.pages.contact.label}
                onChange={(e) =>
                  update((d) => {
                    d.pages.contact.label = e.target.value
                    return d
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={content.pages.contact.title}
                onChange={(e) =>
                  update((d) => {
                    d.pages.contact.title = e.target.value
                    return d
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Sub-heading</Label>
            <Textarea
              rows={2}
              value={content.pages.contact.body}
              onChange={(e) =>
                update((d) => {
                  d.pages.contact.body = e.target.value
                  return d
                })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
