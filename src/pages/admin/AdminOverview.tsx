import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAdmin } from "@/lib/adminStore"
import { useEffect, useState } from "react"
import { fetchMessages } from "@/lib/api"
import type { StoredMessage } from "@/types/content"
import { FileText, Briefcase, FolderKanban, Mails, Image, ExternalLink, Mail } from "lucide-react"

export default function AdminOverview() {
  const { content, loading, error } = useAdmin()
  const [messages, setMessages] = useState<StoredMessage[]>([])
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    fetchMessages()
      .then((res) => {
        setMessages(res.messages ?? [])
        setUnread((res.messages ?? []).filter((m) => !m.read).length)
      })
      .catch(() => {})
  }, [])

  if (loading || !content) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-brown border-t-transparent" />
      </div>
    )
  }

  const sections = [
    { name: "Pages", href: "/admin/pages", icon: FileText, description: "Hero, section headings and homepage copy", meta: `${(content.stats ?? []).length} stats · 4 sections` },
    { name: "Services", href: "/admin/services", icon: Briefcase, description: "Service lines and capabilities", meta: `${content.services.length} services` },
    { name: "Projects", href: "/admin/projects", icon: FolderKanban, description: "Portfolio grid with images", meta: `${content.projects.length} projects` },
    { name: "Media", href: "/admin/media", icon: Image, description: "Photos and video for the site", meta: null },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Everything you publish here appears on the live site.</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/">
            <ExternalLink className="mr-2 h-4 w-4" /> View site
          </Link>
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold">{content.services.length}</p>
                <p className="text-xs text-muted-foreground">Services published</p>
              </div>
              <Briefcase className="h-8 w-8 text-brand-brown/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold">{content.projects.length}</p>
                <p className="text-xs text-muted-foreground">Projects in the grid</p>
              </div>
              <FolderKanban className="h-8 w-8 text-brand-brown/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold">{messages.length}</p>
                <p className="text-xs text-muted-foreground">Messages received</p>
              </div>
              <Mails className="h-8 w-8 text-brand-brown/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold">{unread}</p>
                <p className="text-xs text-muted-foreground">Unread enquiries</p>
              </div>
              <Mail className="h-8 w-8 text-brand-brown/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ name, href, icon: Icon, description, meta }) => (
          <Card key={name}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-5 w-5 text-brand-brown" /> {name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{description}</p>
              {meta && <p className="mt-1 text-xs text-muted-foreground/70">{meta}</p>}
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to={href}>Manage</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mails className="h-5 w-5 text-brand-brown" /> Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Enquiries from the contact form.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {unread > 0 ? `${unread} unread` : "All caught up"}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link to="/admin/messages">Open inbox</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
