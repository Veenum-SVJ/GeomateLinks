// Embeddable Projects sections for the CRM profiles — a lead's or client's
// projects, mirroring the LeadQuotationsSection / ClientQuotationsSection
// pattern. Shows the PMS link when there is at least one project.
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { FolderKanban, Plus } from "lucide-react"
import { fetchProjectsByClient, fetchProjectsByLead } from "@/lib/projectsApi"
import { ProjectMiniRow } from "@/components/admin/projects/ProjectUI"
import type { Project } from "@/types/projects"

function useProjects(loader: () => Promise<{ projects: Project[] }>, key: string) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let active = true
    loader()
      .then((r) => {
        if (active) {
          setProjects(r.projects)
          setLoaded(true)
        }
      })
      .catch(() => {
        if (active) setLoaded(true)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return { projects, loaded }
}

export function LeadProjectsSection({ leadId }: { leadId: string }) {
  const { projects, loaded } = useProjects(() => fetchProjectsByLead(leadId), leadId)
  if (!loaded) return null
  return (
    <section className="rounded-lg border bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
          <FolderKanban className="h-3.5 w-3.5 text-brand-brown" /> Projects ({projects.length})
        </h2>
        <Link to="/admin/pms/new" className="text-xs font-medium text-brand-brown hover:underline">
          Create project
        </Link>
      </div>
      <div className="p-4">
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects yet — accept a quotation and use Create Project, or start one in{" "}
            <Link to="/admin/pms/new" className="text-brand-brown hover:underline">
              Project Management
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id}>
                <ProjectMiniRow project={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export function ClientProjectsSection({ clientId }: { clientId: string }) {
  const { projects, loaded } = useProjects(() => fetchProjectsByClient(clientId), clientId)
  if (!loaded) return null
  return (
    <section className="rounded-lg border bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark">
          <FolderKanban className="h-3.5 w-3.5 text-brand-brown" /> Projects ({projects.length})
        </h2>
        <Link to="/admin/pms/new" className="text-xs font-medium text-brand-brown hover:underline">
          <Plus className="mr-0.5 inline h-3 w-3" /> Create project
        </Link>
      </div>
      <div className="p-4">
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects yet for this client — see{" "}
            <Link to="/admin/pms/all" className="text-brand-brown hover:underline">
              Project Management
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id}>
                <ProjectMiniRow project={p} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
