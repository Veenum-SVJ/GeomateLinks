import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAdmin } from "@/lib/adminStore"
import { useEffect, useState } from "react"
import { fetchMessages, fetchActivity, type PublishEvent, type ActivityMessage } from "@/lib/api"
import type { StoredMessage } from "@/types/content"
import { FileText, Briefcase, FolderKanban, Mails, Image, ExternalLink, Mail, UploadCloud, Globe, History, UploadCloud as PublishIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const quickLinks = [
  { name: "Pages", href: "/admin/pages", icon: FileText },
  { name: "Services", href: "/admin/services", icon: Briefcase },
  { name: "Projects", href: "/admin/projects", icon: FolderKanban },
  { name: "Messages", href: "/admin/messages", icon: Mails },
  { name: "Media", href: "/admin/media", icon: Image },
]

function timeAgo(iso: string) {
  const secs = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (secs < 60) return "just now"
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

type FeedEntry =
  | { kind: "publish"; id: string; at: string; summary: string }
  | { kind: "message"; id: string; at: string; name: string; subject: string; read: boolean }

export default function AdminOverview() {
  const { content, loading, error, dirty, saving, save, lastPublishSummary } = useAdmin()
  const [messages, setMessages] = useState<StoredMessage[]>([])
  const [unread, setUnread] = useState(0)
  const [publishes, setPublishes] = useState<PublishEvent[]>([])
  const [feedMessages, setFeedMessages] = useState<ActivityMessage[]>([])

  useEffect(() => {
    fetchMessages()
      .then((res) => {
        setMessages(res.messages ?? [])
        setUnread((res.messages ?? []).filter((m) => !m.read).length)
      })
      .catch(() => {})
    fetchActivity()
      .then((res) => {
        setPublishes(res.activity ?? [])
        setFeedMessages(res.messages ?? [])
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

  const newest = [...messages].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0]

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

      {/* Quick actions: newest enquiry, publish state and one-tap links —
          the two statuses stay visible side by side on phones while the
          link chips scroll horizontally. */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Link to="/admin/messages" className="block">
            <Card className={cn("h-full transition-colors hover:bg-muted/40", newest && !newest.read && "border-amber-300 bg-amber-50/60")}>
              <CardContent className="p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Newest enquiry</p>
                {newest ? (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">{newest.name}</p>
                    {!newest.read && (
                      <span className="shrink-0 rounded bg-brand-brown px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                        New
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-1.5 text-sm text-muted-foreground">No enquiries yet</p>
                )}
                {newest && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(newest.createdAt)}</p>
                )}
              </CardContent>
            </Card>
          </Link>
          <Card className={cn("h-full", dirty && !saving && "border-amber-300 bg-amber-50/60")}>
            <CardContent className="p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Publish status</p>
              {dirty || saving ? (
                <>
                  <p className="mt-1.5 text-sm font-semibold">{saving ? "Publishing…" : "Unpublished changes"}</p>
                  <Button size="sm" className="mt-2 w-full" onClick={() => save()} disabled={saving}>
                    <UploadCloud className="mr-1 h-3.5 w-3.5" />
                    {saving ? "Publishing…" : "Publish now"}
                  </Button>
                </>
              ) : (
                <>
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" aria-hidden />
                    Live site up to date
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                    <Link to="/"><Globe className="mr-1 h-3.5 w-3.5" /> View site</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {quickLinks.map(({ name, href, icon: Icon }) => (
            <Link
              key={name}
              to={href}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border bg-white px-4 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="h-4 w-4 text-brand-brown" />
              {name}
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity: last publishes (server-logged) interleaved with the
          newest contact messages. A fresh publish updates the first row
          instantly from the client-side summary. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5 text-brand-brown" /> Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {(() => {
            const entries: FeedEntry[] = [
              ...(lastPublishSummary
                ? [{
                    kind: "publish" as const,
                    id: "local-" + Date.now(),
                    at: new Date().toISOString(),
                    summary: lastPublishSummary,
                  }]
                : []),
              ...publishes.map((p) => ({ kind: "publish" as const, ...p })),
              ...feedMessages.map((m) => ({
                kind: "message" as const,
                id: m.id,
                at: m.createdAt,
                name: m.name,
                subject: m.subject,
                read: m.read,
              })),
            ]
            entries.sort((a, b) => +new Date(b.at) - +new Date(a.at))
            const top = entries.slice(0, 6)
            if (!top.length) {
              return <p className="py-3 text-sm text-muted-foreground">No activity yet — publishes and new enquiries will appear here.</p>
            }
            return top.map((e, i) => (
              <div
                key={e.id + "-" + i}
                className="flex items-start justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/40"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      e.kind === "publish" ? "bg-brand-brown/10 text-brand-brown" : "bg-amber-100 text-amber-700",
                    )}
                  >
                    {e.kind === "publish" ? <PublishIcon className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                  </span>
                  <p className="min-w-0 text-sm leading-snug">
                    {e.kind === "publish" ? (
                      <>
                        <span className="font-medium">Published to live site</span>
                        <span className="text-muted-foreground"> — {e.summary}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium">{e.name}</span>
                        {!e.read && (
                          <span className="ml-1 rounded bg-brand-brown px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-white">New</span>
                        )}
                        <span className="truncate text-muted-foreground">— {e.subject || "(no subject)"}</span>
                      </>
                    )}
                  </p>
                </div>
                <time className="shrink-0 pt-0.5 text-xs text-muted-foreground">{timeAgo(e.at)}</time>
              </div>
            ))
          })()}
        </CardContent>
      </Card>

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
