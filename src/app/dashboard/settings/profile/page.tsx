import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";

export default function ProfileSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your personal account details.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your name and email address.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="grid gap-3">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" defaultValue="Admin User" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" defaultValue="admin@example.com" />
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
       <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password. Leave fields blank to keep current password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid gap-3">
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid gap-3">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" />
                </div>
                <div className="grid gap-3">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input id="confirm-password" type="password" />
                </div>
            </div>
          <div className="flex justify-end">
            <Button>
                <Save className="mr-2 h-4 w-4" />
                Update Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
