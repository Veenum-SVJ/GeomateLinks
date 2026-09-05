import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Briefcase, FolderKanban, Image, Settings, UserCircle } from "lucide-react"

export default function AdminOverview() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome to the admin dashboard.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Manage website pages</p>
            <Button asChild className="w-full mt-2">
              <Link to="/admin/pages">Go to Pages</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" /> Services</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Manage services</p>
            <Button asChild className="w-full mt-2">
              <Link to="/admin/services">Go to Services</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FolderKanban className="h-5 w-5" /> Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Manage projects</p>
            <Button asChild className="w-full mt-2">
              <Link to="/admin/projects">Go to Projects</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Image className="h-5 w-5" /> Media</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Upload media</p>
            <Button asChild className="w-full mt-2">
              <Link to="/admin/media">Go to Media</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Manage settings</p>
            <Button asChild className="w-full mt-2">
              <Link to="/admin/settings">Go to Settings</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCircle className="h-5 w-5" /> Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Manage profile</p>
            <Button asChild className="w-full mt-2">
              <Link to="/admin/settings/profile">Go to Profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}