// Client history page: profile, history counts (leads, projects, follow-ups),
// related portfolio projects, linked leads, messages and the activity
// timeline — the whole relationship in one place.
import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Pencil, Building2, Users, CalendarClock, FolderKanban, Mail, StickyNote, Briefcase, MapPin, Phone, ExternalLink, Trash2 } from "lucide-react"
import type { SiteContent } from "@/types/content"
import type { ClientDetailResult } from "@/types/crm"
import { fetchClient, deleteClient } from "@/lib/crmApi"
import { fetchContent, fallbackContent } from "@/lib/api"
import { CrmSpinner, CrmErrorState, CrmEmptyState, crmRelativeTime, crmDayOnly, CrmConfirmDialog, LeadStatusBadge } from "@/components/admin/crm/CrmUI"
import { ActivityTimeline, FollowupsList, AddActivityDialog, FollowupDialog } from "@/components/admin/crm/TimelineComponents"
import ClientFormDialog from "@/components/admin/crm/ClientFormDialog"

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ClientDetailResult | null>(null)
  const [content, setContent] = useState<SiteContent | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState("")
  const [actionError, setActionError] = useState("")
  const [editOpen, setEditOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [followupOpen, setFollowupOpen] = useState(false)
  const [confirm, setConfirm] = useState<null | { title: string; description: string; confirmLabel: string; run: () => Promise<void> }>(null)

  const load = useCallback(async () => {
    if (!id) return
    setError("")
    try {
      setDetail(await fetchClient(id))
      setNotFound(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load the client"
      if (message.includes("404")) setNotFound(true)
      setError(message)
    }
  }, [id])

  useEffect(() => {
    load()
    fetchContent()
      .then(setContent)
      .catch(() => setContent(null))
  }, [load])

  const doDelete = async () => {
    if (!detail) return
    await deleteClient(detail.client.id)
    navigate("/admin/crm/clients")
  }

  if (notFound) {
    return (
      <CrmEmptyState
        icon={<Building2 className="h-8 w-8" />}
        title="Client not found"
        description="It may have been deleted. Head back to the clients list."
      />
    )
  }

  const client = detail?.client
  const projects = content?.projects || fallbackContent.projects
  // Client project association: projectRef on their linked leads. Converting
  // or creating a project from a lead carries it here automatically.
  const projectRefs = (detail?.leads || [])
    .map((l) => l.projectRef)
    .filter((ref) => ref && (ref.id || ref.title))
  const linkedProjects = projects.filter((p) => projectRefs.some((ref) => ref.id === p.id || ref.title === p.title))

  return (
    <div className="space-y-4">
      <Link to="/admin/crm/clients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All clients
      </Link>

      {error && <CrmErrorState message={error} onRetry={load} />}
      {!detail && !error && <CrmSpinner />}

      {client && detail && (
        <>
          <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Client {client.code}</p>
              <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-brand-dark">{client.name}</h1>
              {client.company && <p className="text-sm text-muted-foreground">{client.company}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{client.type}</span>
                {client.industry && <span className="inline-flex items-center rounded-full border bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{client.industry}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button onClick={() => setActivityOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
                <Users className="h-3.5 w-3.5" /> Add Activity
              </button>
              <button onClick={() => setFollowupOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
                <CalendarClock className="h-3.5 w-3.5" /> Schedule Follow-up
              </button>
              <button onClick={() => setConfirm({
                title: "Delete client",
                description: "This removes the client record. Leads linked to it stay intact but lose their client link.",
                confirmLabel: "Delete",
                run: doDelete,
              })} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>

          {actionError && <CrmErrorState message={actionError} />}

          {/* History counts */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              [
                ["Leads", detail.leads.length, Users],
                ["Projects", linkedProjects.length, FolderKanban],
                ["Follow-ups", detail.followups.length, CalendarClock],
                ["Client since", crmDayOnly(client.createdAt), CalendarClock],
              ] as const
            ).map(([label, value, Icon]) => (
              <div key={label} className="rounded-lg border bg-white px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
                  <Icon className="h-4 w-4 text-brand-green" />
                </div>
                <p className="mt-1 text-2xl font-semibold text-brand-dark">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-1">
              <section className="rounded-lg border bg-white p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
                  <Phone className="h-3.5 w-3.5 text-brand-brown" /> Contact
                </h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd>{client.phone ? <a href={`tel:${client.phone}`} className="hover:underline">{client.phone}</a> : "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="min-w-0 truncate">{client.email ? <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a> : "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">WhatsApp</dt>
                    <dd>{client.whatsapp ? <a href={`https://wa.me/${client.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="hover:underline">{client.whatsapp}</a> : "—"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <dt className="text-muted-foreground">Address</dt>
                    <dd className="flex items-center gap-1 text-right">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {client.address || "—"}
                    </dd>
                  </div>
                </dl>
                {client.notes && (
                  <div className="mt-3 border-t pt-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <StickyNote className="h-3 w-3" /> Internal notes
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{client.notes}</p>
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-4 lg:col-span-2">
              {/* Projects */}
              <section className="rounded-lg border bg-white p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
                  <FolderKanban className="h-3.5 w-3.5 text-brand-brown" /> Projects
                </h2>
                {linkedProjects.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No projects linked yet. Create one from a won lead.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {linkedProjects.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                        <span className="min-w-0 truncate font-medium text-brand-dark">{p.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{[p.category, p.location, p.status].filter(Boolean).join(" · ")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Linked leads */}
              <section className="rounded-lg border bg-white p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
                  <Users className="h-3.5 w-3.5 text-brand-brown" /> Leads ({detail.leads.length})
                </h2>
                {detail.leads.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No leads linked to this client.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {detail.leads.map((l) => (
                      <li key={l.id}>
                        <Link to={`/admin/crm/leads/${l.id}`} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-brand-dark">
                              {l.code} — {l.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">{[l.service?.title, l.location].filter(Boolean).join(" · ")}</span>
                          </span>
                          <LeadStatusBadge status={l.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Messages (from linked website-form leads) */}
              <section className="rounded-lg border bg-white p-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
                  <Mail className="h-3.5 w-3.5 text-brand-brown" /> Messages
                </h2>
                {(detail.leads.filter((l) => l.messageRef).length) === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No website enquiries linked.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {detail.leads
                      .filter((l) => l.messageRef)
                      .map((l) => (
                        <li key={l.id}>
                          <Link to="/admin/messages" className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/50">
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-brand-dark">Website enquiry — {l.code}</span>
                              <span className="block truncate text-xs text-muted-foreground">{crmRelativeTime(l.createdAt)}</span>
                            </span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          </Link>
                        </li>
                      ))}
                  </ul>
                )}
              </section>

              {/* Timeline + follow-ups */}
              <section className="rounded-lg border bg-white">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
                    <Briefcase className="h-3.5 w-3.5 text-brand-brown" /> History
                  </h2>
                </div>
                <div className="space-y-5 p-4">
                  <div>
                    <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Activities</p>
                    <ActivityTimeline activities={detail.activities} />
                  </div>
                  <div>
                    <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Follow-ups</p>
                    <FollowupsList
                      followups={detail.followups}
                      onChanged={() => {
                        load()
                      }}
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>

          <ClientFormDialog
            open={editOpen}
            client={client}
            onClose={() => setEditOpen(false)}
            onSaved={() => {
              setEditOpen(false)
              load()
            }}
          />
          <AddActivityDialog open={activityOpen} owner={{ ownerType: "client", ownerId: client.id, ownerCode: client.code, ownerName: client.name }} onClose={() => setActivityOpen(false)} onSaved={() => { setActivityOpen(false); load() }} />
          <FollowupDialog open={followupOpen} owner={{ ownerType: "client", ownerId: client.id, ownerCode: client.code, ownerName: client.name }} onClose={() => setFollowupOpen(false)} onSaved={() => { setFollowupOpen(false); load() }} />
          <CrmConfirmDialog
            open={confirm !== null}
            title={confirm?.title || ""}
            description={confirm?.description || ""}
            confirmLabel={confirm?.confirmLabel}
            onConfirm={() => {
              const run = confirm?.run
              setConfirm(null)
              run?.().catch((err) => setActionError(err instanceof Error ? err.message : "Action failed"))
            }}
            onCancel={() => setConfirm(null)}
          />
        </>
      )}
    </div>
  )
}
