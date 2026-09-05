import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Save } from "lucide-react"
import { useAdminAuth } from "@/hooks/useAdminAuth"

export default function ProfilePage() {
  const { authenticated, login } = useAdminAuth()
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your personal account details.</p>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-lg mb-4">Personal Information</h3>
        <p className="text-sm text-muted-foreground mb-4">Manage your name and email address.</p>
        <div className="space-y-4">
          <Label>Full Name</Label>
          <Input placeholder="Enter your full name" />
        </div>
        <div className="space-y-4">
          <Label>Email Address</Label>
          <Input type="email" placeholder="Enter your email address" />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => {/* Save changes */}} className="w-full">
            Save Changes
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6 mt-6">
        <h3 className="font-semibold text-lg mb-4">Change Password</h3>
        <p className="text-sm text-muted-foreground mb-4">Update your account password. Leave fields blank to keep current password.</p>
        <div className="space-y-4">
          <Label>Current Password</Label>
          <Input type="password" placeholder="Enter current password" />
        </div>
        <div className="space-y-4">
          <Label>New Password</Label>
          <Input type="password" placeholder="Enter new password" />
        </div>
        <div className="space-y-4">
          <Label>Confirm New Password</Label>
          <Input type="password" placeholder="Confirm new password" />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => {/* Change password */}} className="w-full">
            Change Password
          </Button>
        </div>
      </div>
    </div>
  )
}