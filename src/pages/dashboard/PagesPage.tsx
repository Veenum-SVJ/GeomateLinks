import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileEdit } from "lucide-react"

export default function PagesPage() {
  const pages = [
    { name: "About Us Page", description: "Edit the main content of your 'About Us' section." },
    { name: "Services Page", description: "Update the introduction to your services." },
    { name: "Contact Page", description: "Modify the information displayed on the contact page." },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pages Management</h1>
        <p className="text-muted-foreground">Edit the content of your website's main pages here.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Editable Pages</CardTitle>
          <CardDescription>Select a page to edit its content.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pages.map((page) => (
            <div key={page.name} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <h3 className="font-semibold">{page.name}</h3>
                <p className="text-sm text-muted-foreground">{page.description}</p>
              </div>
              <Button variant="outline" size="sm">
                <FileEdit className="mr-2 h-4 w-4" /> Edit
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
