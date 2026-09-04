import { Link } from "react-router-dom"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Briefcase, FolderKanban, Mail, Image, MessageSquare } from "lucide-react"

export default function AdminDashboard() {
  const stats = [
    { name: "Pages", description: "About, Services, Contact", href: "/admin/pages", icon: FileText },
    { name: "Services", description: "Manage services", href: "/admin/services", icon: Briefcase },
    { name: "Projects", description: "Project gallery", href: "/admin/projects", icon: FolderKanban },
    { name: "Messages", description: "Contact form submissions", href: "/admin/messages", icon: Mail },
    { name: "Media", description: "Image & video library", href: "/admin/media", icon: Image },
    { name: "Feedback", description: "Visitor feedback", href: "/admin/messages", icon: MessageSquare },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Manage your website content, media, and settings.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.name} to={stat.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className="rounded-lg bg-brand-brown/10 p-3">
                  <stat.icon className="h-6 w-6 text-brand-brown" />
                </div>
                <div>
                  <CardTitle className="text-base">{stat.name}</CardTitle>
                  <CardDescription>{stat.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
