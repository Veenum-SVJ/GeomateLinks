import { Link, NavLink, Outlet } from "react-router-dom"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAdmin } from "@/lib/adminStore"
import AdminLogin from "./AdminLogin"
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  FolderKanban,
  Image as Images,
  Inbox,
  Settings,
  LogOut,
  Menu,
  X,
  Save,
  ExternalLink,
} from "lucide-react"

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/home", label: "Home page", icon: FileText },
  { to: "/admin/services", label: "Services", icon: Briefcase },
  { to: "/admin/projects", label: "Projects", icon: FolderKanban },
  { to: "/admin/media", label: "Media", icon: Images },
  { to: "/admin/messages", label: "Messages", icon: Inbox },
  { to: "/admin/settings", label: "Company & SEO", icon: Settings },
]

export default function AdminLayout() {
  const { loading, authenticated, content, dirty, saving, save, error, notice, signOut } = useAdmin()
  const [open, setOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!authenticated) return <AdminLogin />

  return (
    <div className="min-h-screen bg-muted">
      <div className="flex min-h-screen">
        {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card transition-transform lg:static lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-border px-5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded bg-primary font-mono text-xs font-bold text-primary-foreground">
                GL
              </span>
              <div className="leading-tight">
                <p className="font-mono text-xs font-bold tracking-wide">GEOMATE CMS</p>
                <p className="text-[11px] text-muted-foreground">Content manager</p>
              </div>
            </div>
            <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="space-y-1 border-t border-border p-3">
            <Link
              to="/"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
              View website
            </Link>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card px-4 lg:px-8">
            <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{content?.company.name ?? "Geomate Links"}</p>
              <p className="text-xs text-muted-foreground">
                {dirty ? "Unsaved changes" : "All changes published"}
              </p>
            </div>
            <Button onClick={save} disabled={!dirty || saving} size="sm">
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Publishing…" : "Publish"}
            </Button>
          </header>

          {(error || notice) && (
            <div className="px-4 pt-4 lg:px-8">
              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              {notice && !error && (
                <div className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
                  {notice}
                </div>
              )}
            </div>
          )}

          <main className="flex-1 p-4 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
