import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, KeyRound, ShieldAlert } from "lucide-react"

// The admin password lives in the ADMIN_PASSWORD environment variable in the
// Vercel project settings — it cannot be changed from the dashboard itself.
export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Account and security settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-brand-brown" />
            Admin password
          </CardTitle>
          <CardDescription>
            The dashboard password is stored securely as an environment variable, not in the code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-amber-800">Password protection is currently disabled.</p>
              <p className="text-amber-700">
                While the site is under construction, the dashboard opens without a password. Before
                launch, remove the <code className="rounded bg-amber-100 px-1 font-mono text-xs">ADMIN_AUTH_DISABLED</code>{" "}
                variable in Vercel and the login gate comes back automatically.
              </p>
            </div>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Open the Vercel dashboard and select the <strong>geomate-links</strong> project.</li>
            <li>Go to Settings → Environment Variables.</li>
            <li>
              Set <code className="rounded bg-muted px-1 font-mono text-xs">ADMIN_PASSWORD</code> to the password you want,
              and delete <code className="rounded bg-muted px-1 font-mono text-xs">ADMIN_AUTH_DISABLED</code>.
            </li>
            <li>Redeploy — the login page replaces this open dashboard.</li>
          </ol>
          <Button variant="outline" asChild>
            <a href="https://vercel.com/adhaarith-gmailcoms-projects/geomate-links/settings/environment-variables" target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Vercel environment settings
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Sessions last 8 hours and are stored in a signed, HttpOnly cookie.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No active session is required while password protection is off. Once the gate is
            re-enabled, signing out clears the session cookie on all devices.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
