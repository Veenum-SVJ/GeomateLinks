import { Link } from 'react-router-dom'
import { LayoutDashboard, FileText, Briefcase, FolderKanban, Mails, Image, Settings } from 'lucide-react'

// DEV MODE: this page now acts as the admin landing screen — password
// protection is disabled while the site is under construction and will be
// re-enabled before launch. It shares the survey-sheet backdrop with the
// homepage About section.
const quickLinks = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, description: 'Overview of the practice site' },
  { name: 'Pages', href: '/admin/pages', icon: FileText, description: 'About, services and contact copy' },
  { name: 'Services', href: '/admin/services', icon: Briefcase, description: 'Service lines and capabilities' },
  { name: 'Projects', href: '/admin/projects', icon: FolderKanban, description: 'Completed assignments and records' },
  { name: 'Messages', href: '/admin/messages', icon: Mails, description: 'Enquiries from the contact form' },
  { name: 'Media', href: '/admin/media', icon: Image, description: 'Photos, video and project imagery' },
  { name: 'Settings', href: '/admin/settings', icon: Settings, description: 'Company profile and site settings' },
]

export default function AdminLogin() {
  return (
    <div className="survey-sheet flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-2 text-center">
          <span className="inline-block rounded-full border border-brand-brown/30 bg-white/70 px-3 py-1 font-mono text-xs tracking-widest text-brand-brown">
            GEOMATE LINKS · ADMIN
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-brand-dark">
            Welcome to the practice dashboard
          </h1>
          <p className="text-sm text-muted-foreground">Continue to any section below.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="group rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <item.icon className="h-5 w-5 text-brand-brown" />
              <p className="mt-2 font-medium text-brand-dark">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Password protection is disabled during development and will be re-enabled before launch.
        </p>
      </div>
    </div>
  )
}
