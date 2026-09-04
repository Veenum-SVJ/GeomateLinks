import { Outlet, Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Home, FileText, Briefcase, FolderKanban, Mails, Image, Settings, UserCircle, LogOut, LifeBuoy } from "lucide-react"

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Pages", href: "/dashboard/pages", icon: FileText },
  { name: "Services", href: "/dashboard/services", icon: Briefcase },
  { name: "Projects", href: "/dashboard/projects", icon: FolderKanban },
  { name: "Messages", href: "/dashboard/messages", icon: Mails },
  { name: "Media", href: "/dashboard/media", icon: Image },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

export default function DashboardLayout() {
  const location = useLocation()

  return (
    <div className="flex min-h-screen w-full flex-col bg-brand-cream text-brand-dark">
      <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-white px-4 md:px-6">
        <nav className="hidden flex-1 flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:justify-center md:gap-5 md:text-sm lg:gap-6">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href || (item.href === "/dashboard/settings" && location.pathname.startsWith("/dashboard/settings"))
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-2 transition-colors hover:text-foreground",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
          <div className="ml-auto">
            <details className="relative">
              <summary className="flex items-center justify-center rounded-full h-10 w-10 cursor-pointer list-none">
                <UserCircle className="h-5 w-5" />
              </summary>
              <div className="absolute right-0 mt-2 w-56 rounded-md border bg-white p-2 shadow">
                <div className="px-2 py-1.5 text-sm font-medium">My Account</div>
                <div className="my-1 h-px bg-border" />
                <Link to="/dashboard/settings/profile" className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                  <UserCircle className="h-4 w-4" /> Profile Settings
                </Link>
                <a href="#" className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                  <LifeBuoy className="h-4 w-4" /> Support
                </a>
                <div className="my-1 h-px bg-border" />
                <Link to="/" className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                  <LogOut className="h-4 w-4" /> Logout
                </Link>
              </div>
            </details>
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
