import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import MediaField from "@/components/admin/MediaField"
import { useAdminAuth } from "@/hooks/useAdminAuth"
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react"

export default function AdminHome() {
  const { authenticated, login, logout } = useAdminAuth()
  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Admin Login</h1>
            <p className="text-sm text-muted-foreground">Please log in to access the admin dashboard.</p>
          </div>
          <AdminLogin onLoginSuccess={() => {}} />
        </div>
      </div>
    )
  }

  // For demo purposes, show empty states when authenticated
  // In a real app, you would fetch data from your API endpoints
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to the admin dashboard. Use the navigation to manage your website.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-lg mb-4">Pages Management</h3>
          <p className="text-sm text-muted-foreground mb-4">Edit website pages and content.</p>
          <Button onClick={() => {/* navigate to pages */}} className="w-full mb-2">
            <Link to="/admin/pages">Go to Pages</Link>
          </Button>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-lg mb-4">Services</h3>
          <p className="text-sm text-muted-foreground mb-4">Manage your company's services.</p>
          <Button onClick={() => {/* navigate to services */}} className="w-full mb-2">
            <Link to="/admin/services">Go to Services</Link>
          </Button>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-lg mb-4">Projects</h3>
          <p className="text-sm text-muted-foreground mb-4">Manage your project gallery.</p>
          <Button onClick={() => {/* navigate to projects */}} className="w-full mb-2">
            <Link to="/admin/projects">Go to Projects</Link>
          </Button>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-lg mb-4">Messages</h3>
          <p className="text-sm text-muted-foreground mb-4">View and manage contact form submissions.</p>
          <Button onClick={() => {/* navigate to messages */}} className="w-full mb-2">
            <Link to="/admin/messages">Go to Messages</Link>
          </Button>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-lg mb-4">Media Library</h3>
          <p className="text-sm text-muted-foreground mb-4">Upload and manage images, videos, and documents.</p>
          <Button onClick={() => {/* navigate to media */}} className="w-full mb-2">
            <Link to="/admin/media">Go to Media</Link>
          </Button>
        </div>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-lg mb-4">Settings</h3>
          <p className="text-sm text-muted-foreground mb-4">Manage website settings and contact information.</p>
          <Button onClick={() => {/* navigate to settings */}} className="w-full mb-2">
            <Link to="/admin/settings">Go to Settings</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}