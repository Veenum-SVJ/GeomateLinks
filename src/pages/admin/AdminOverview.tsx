import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAdmin } from "@/lib/adminStore"
import { Briefcase, FolderKanban, Image as Images, Inbox, FileText, Settings } from "lucide-react"

export default function AdminOverview() {
  const { content } = useAdmin()
  if (!content) return null

  const cards = [
    {
      to: "/admin/home",
      icon: FileText,
      title: "Home page",
      description: "Hero text, video, stats, about copy and images.",
      meta: `${content.aboutImages?.length ?? 0} about images`,
    },
    {
      to: "/admin/services",
      icon: Briefcase,
      title: "Services",
      description: "Service lines shown on the website.",
      meta: `${content.services.length} services`,
    },
    {
      to: "/admin/projects",
      icon: FolderKanban,
      title: "Projects",
      description: "Project gallery, four per page.",
      meta: `${content.projects.length} projects`,
    },
    {
      to: "/admin/media",
      icon: Images,
      title: "Media library",
      description: "Upload and manage images and videos.",
      meta: "Vercel Blob storage",
    },
    {
      to: "/admin/messages",
      icon: Inbox,
      title: "Messages",
      description: "Enquiries submitted through the contact form.",
      meta: "Server stored",
    },
    {
      to: "/admin/settings",
      icon: Settings,
      title: "Company & SEO",
      description: "Address, phones, email, map, page labels.",
      meta: content.company.rcNumber,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Content overview</h1>
        <p className="text-sm text-muted-foreground">
          Edit any section, then press Publish to push changes live. No code required.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.to} to={card.to}>
            <Card className="h-full transition hover:border-primary/40 hover:shadow-sm">
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <card.icon className="h-5 w-5 text-primary" />
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-base">{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{card.meta}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
