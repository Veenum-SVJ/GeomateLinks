import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Save } from "lucide-react"
import content from "@/data/content.json"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">General Site Settings</h1>
        <p className="text-muted-foreground">Manage your website's general settings and public contact information.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>Update your company's public contact details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3">
            <Label htmlFor="address">Address</Label>
            <Input id="address" defaultValue={`${content.company.address.suite}, ${content.company.address.street}, ${content.company.address.city}, ${content.company.address.state}`} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="grid gap-3">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" defaultValue={content.company.phones[0]} />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" defaultValue={content.company.emails[0]} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="grid gap-3">
              <Label htmlFor="facebook">Facebook URL</Label>
              <Input id="facebook" defaultValue={content.company.facebook} />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="twitter">Twitter/X URL</Label>
              <Input id="twitter" defaultValue="#" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="linkedin">LinkedIn URL</Label>
              <Input id="linkedin" defaultValue="#" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
