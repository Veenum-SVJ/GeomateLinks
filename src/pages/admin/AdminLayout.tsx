import { useState } from 'react'
import { Link, Outlet, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { AdminProvider, useAdmin } from "@/lib/adminStore"
import { UnreadMessagesProvider, useUnreadMessages } from "@/hooks/useUnreadMessages"
import { LayoutDashboard, FileText, Briefcase, FolderKanban, Mails, Image, Settings, UserCircle, ExternalLink, Menu, X, UploadCloud, RotateCcw, Users, Building2, CalendarClock, History, ReceiptText } from "lucide-react"

const navItems = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Pages", href: "/admin/pages", icon: FileText },
  { name: "Services", href: "/admin/services", icon: Briefcase },
  { name: "Projects", href: "/admin/projects", icon: FolderKanban },
  { name: "Messages", href: "/admin/messages", icon: Mails },
]

// CRM sub-navigation — a group in the existing sidebar style, active when
// any /admin/crm route is open.
const crmNavItems = [
  { name: "Leads", href: "/admin/crm/leads", icon: Users },
  { name: "Clients", href: "/admin/crm/clients", icon: Building2 },
  { name: "Follow-ups", href: "/admin/crm/followups", icon: CalendarClock },
  { name: "Activities", href: "/admin/crm/activities", icon: History },
]

export default function AdminLayout() {
  return (
    <AdminProvider>
      <UnreadMessagesProvider>
        <AdminShell />
      </UnreadMessagesProvider>
    </AdminProvider>
  )
}

function AdminShell() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { dirty, saving, error, notice, save, reload } = useAdmin()
  const { unread } = useUnreadMessages()

  return (
    <div className="admin-root flex min-h-screen w-full bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:block",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center justify-between px-6 border-b">
          <Link to="/admin" className="flex items-center gap-2 font-mono text-sm font-bold tracking-tight text-brand-dark">
            <img src="/favicon.ico" alt="Logo" className="h-6 w-6 rounded" />
            GEOMATE LINKS CONSULTING LTD
          </Link>
          <button className="-m-2 p-2 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-brand-brown/10 text-brand-brown" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
                {item.name === "Messages" && unread > 0 && (
                  <span
                    className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-brand-brown px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
                    aria-label={`${unread} unread message${unread === 1 ? "" : "s"}`}
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            )
          })}

          {(() => {
            const crmActive = location.pathname === "/admin/crm" || location.pathname.startsWith("/admin/crm/")
            const quotationsActive = location.pathname.startsWith("/admin/quotations")
            return (
              <>
                <div className="pt-3">
                  <Link
                    to="/admin/crm"
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors",
                      crmActive ? "bg-brand-brown/10 text-brand-brown" : "text-brand-dark hover:bg-muted"
                    )}
                  >
                    <Users className="h-4 w-4" />
                    CRM
                  </Link>
                </div>
                <div className={cn("ml-4 space-y-1 border-l", crmActive ? "border-brand-brown/30" : "border-border")}>
                  {crmNavItems.map((item) => {
                    const isActive = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`)
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          isActive ? "bg-brand-brown/10 text-brand-brown" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    )
                  })}
                </div>

                {/* Quotations — sibling of CRM, feeds the future PMS. */}
                <div className="pt-3">
                  <Link
                    to="/admin/quotations"
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors",
                      quotationsActive ? "bg-brand-brown/10 text-brand-brown" : "text-brand-dark hover:bg-muted"
                    )}
                  >
                    <ReceiptText className="h-4 w-4" />
                    Quotations
                  </Link>
                </div>
                <div className={cn("ml-4 space-y-1 border-l", quotationsActive ? "border-brand-brown/30" : "border-border")}>
                  {[
                    { name: "Overview", href: "/admin/quotations", icon: ReceiptText },
                    { name: "All Quotations", href: "/admin/quotations/all", icon: FileText },
                  ].map((item) => {
                    const isActive = location.pathname === item.href
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          isActive ? "bg-brand-brown/10 text-brand-brown" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    )
                  })}
                </div>
              </>
            )
          })()}

          <div className="pt-3">
            {[
              { name: "Media", href: "/admin/media", icon: Image },
              { name: "Settings", href: "/admin/settings", icon: Settings },
            ].map((item) => {
              const isActive = location.pathname === item.href || (item.href === "/admin/settings" && location.pathname.startsWith("/admin/settings"))
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive ? "bg-brand-brown/10 text-brand-brown" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            View Site
          </Link>
          <div className="flex items-center gap-2 mt-2">
            <Link to="/admin/settings/profile" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <UserCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white px-4 lg:px-6">
          <button className="-m-2 p-2 md:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 flex items-center gap-2">
            <h1 className="font-mono text-sm font-semibold text-brand-dark">Admin Dashboard</h1>
            {/* DEV MODE marker: reminder that password protection is off until launch. */}
            <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
              Dev mode · no password
            </span>
          </div>
        </header>
        {(dirty || saving) && (
          <div className="sticky top-16 z-20 flex flex-col gap-2.5 border-b bg-amber-50 px-4 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 lg:px-6">
            <span className="text-sm font-medium text-amber-800">
              {saving ? "Publishing…" : "You have unpublished changes"}
            </span>
            <div className="flex items-center gap-2 sm:ml-auto">
              <button
                onClick={() => reload()}
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 sm:flex-none sm:py-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Discard
              </button>
              <button
                onClick={() => save()}
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-xs font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50 sm:flex-none sm:py-1.5"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                {saving ? "Publishing…" : "Publish to live site"}
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="border-b bg-red-50 px-4 py-2 text-sm text-red-700 lg:px-6">{error}</div>
        )}
        {notice && !dirty && !error && (
          <div className="border-b bg-green-50 px-4 py-2 text-sm text-green-700 lg:px-6">{notice}</div>
        )}
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
