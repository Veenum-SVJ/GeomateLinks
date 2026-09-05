import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { Briefcase, FileText, FolderKanban, Images, Inbox, FileText, Settings } from "lucide-react"

export default function AdminOverview() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    pages: 0,
    services: 0,
    projects: 0,
    messages: 0,
    media: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch counts from API
        const [pagesRes, servicesRes, projectsRes, messagesRes, mediaRes] = await Promise.all([
          fetch('/api/admin/content'),
          fetch('/api/admin/content/services'),
          fetch('/api/admin/content/projects'),
          fetch('/api/admin/messages'),
          fetch('/api/admin/media')
        ])
        
        const pagesData = await pagesRes.json()
        const servicesData = await servicesRes.json()
        const projectsData = await projectsRes.json()
        const messagesData = await messagesRes.json()
        const mediaData = await mediaRes.json()
        
        setStats({
          pages: Object.keys(pagesData || {}).length,
          services: Array.isArray(servicesData) ? servicesData.length : 0,
          projects: Array.isArray(projectsData) ? projectsData.length : 0,
          messages: Array.isArray(messagesData) ? messagesData.length : 0,
          media: Array.isArray(mediaData) ? mediaData.length : 0
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchStats()
  }, [user])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-brown border-t-transparent" />
      </div>
    )
  }

  const cards = [
    {
      to: "/admin/home",
      icon: FileText,
      title: "Home Page",
      description: "Edit home page content, hero section, and about section",
      meta: `${stats.pages} sections`
    },
    {
      to: "/admin/services",
      icon: Briefcase,
      title: "Services",
      description: "Manage service offerings",
      meta: `${stats.services} services`
    },
    {
      to: "/admin/projects",
      icon: FolderKanban,
      title: "Projects",
      description: "Manage project gallery",
      meta: `${stats.projects} projects`
    },
    {
      to: "/admin/media",
      icon: Images,
      title: "Media Library",
      description: "Upload and manage images and videos",
      meta: `${stats.media} files`
    },
    {
      to: "/admin/messages",
      icon: Inbox,
      title: "Messages",
      description: "View and manage contact form submissions",
      meta: `${stats.messages} messages`
    },
    {
      to: "/admin/settings",
      icon: Settings,
      title: "Settings",
      description: "Manage site settings and contact information",
      meta: "Site configuration"
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage your website content and settings</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.to} to={card.to}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className="rounded-lg bg-brand-brown/10 p-3">
                  <card.icon className="h-6 w-6 text-brand-brown" />
                </div>
                <div>
                  <CardTitle className="text-base">{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-xs uppercase tracking-wide text-brand-warm-gray">{card.meta}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}