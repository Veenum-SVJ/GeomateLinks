// Staff / Team Directory — names, roles and contact details only. No logins
// (the platform has a single administrator); the structure is ready for
// future staff accounts. Members can be assigned to projects and tasks.
import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Plus, Search, Trash2, Users } from "lucide-react"
import { createStaffMember, updateStaffMember, deleteStaffMember, fetchStaff } from "@/lib/projectsApi"
import { CrmSpinner, CrmErrorState, CrmEmptyState, CrmConfirmDialog } from "@/components/admin/crm/CrmUI"
import { SimpleStatusBadge } from "@/components/admin/projects/ProjectUI"
import type { StaffMember } from "@/types/projects"

export default function StaffDirectory() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [confirm, setConfirm] = useState<null | { id: string; name: string }>(null)

  const load = useCallback(async () => {
    setError("")
    try {
      setStaff(await fetchStaff().then((r) => r.staff))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the team directory")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = staff.filter((s) =>
    [s.name, s.role, s.specialization, s.email, s.phone].join(" ").toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-dark">Team Directory</h1>
          <p className="text-sm text-muted-foreground">
            People who can be assigned to projects and tasks. No logins — future staff accounts will build on this directory.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setEditorOpen(true) }}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90"
        >
          <Plus className="h-4 w-4" /> Add Staff Member
        </button>
      </div>

      <div className="rounded-lg border bg-white p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, role, specialization…"
            className="w-full rounded-md border py-2 pl-8 pr-3 text-sm"
          />
        </div>
      </div>

      {error && <CrmErrorState message={error} onRetry={load} />}
      {loading && staff.length === 0 && <CrmSpinner />}

      {staff.length === 0 && !loading ? (
        <CrmEmptyState
          icon={<Users className="h-8 w-8" />}
          title="The directory is empty"
          description="Add your surveyors, GIS analysts and technicians so they can be assigned to projects and tasks."
          actionLabel="Add Staff Member"
          onAction={() => { setEditing(null); setEditorOpen(true) }}
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((member) => (
            <li key={member.id} className="flex flex-col gap-2 rounded-lg border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-brand-dark">
                  {member.name}
                  <SimpleStatusBadge status={String(member.status)} />
                </p>
                <p className="text-xs text-muted-foreground">{[member.role, member.specialization].filter(Boolean).join(" · ") || "—"}</p>
                <p className="text-xs text-muted-foreground">{[member.email, member.phone].filter(Boolean).join(" · ") || "no contact details"}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button onClick={() => { setEditing(member); setEditorOpen(true) }} className="rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted">
                  Edit
                </button>
                <button onClick={() => setConfirm({ id: member.id, name: member.name })} className="rounded-md border px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                  <Trash2 className="h-3 w-3" />
                  <span className="sr-only">Remove {member.name}</span>
                </button>
              </div>
            </li>
          ))}
          {filtered.length === 0 && staff.length > 0 && (
            <li className="rounded-md border border-dashed px-3 py-3 text-center text-sm text-muted-foreground">No one matches “{query}”.</li>
          )}
        </ul>
      )}

      <StaffEditorDialog open={editorOpen} member={editing} onClose={() => setEditorOpen(false)} onSaved={() => { setEditorOpen(false); load() }} />
      <CrmConfirmDialog
        open={confirm !== null}
        title={`Remove ${confirm?.name}?`}
        description="Assignments already recorded on projects keep the person's name — the directory entry is removed only from future pickers."
        confirmLabel="Remove"
        onConfirm={() => {
          const target = confirm
          setConfirm(null)
          deleteStaffMember(target!.id)
            .then(load)
            .catch((err) => setError(err instanceof Error ? err.message : "Could not remove the staff member"))
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}

function StaffEditorDialog({ open, member, onClose, onSaved }: { open: boolean; member: StaffMember | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [specialization, setSpecialization] = useState("")
  const [status, setStatus] = useState("Active")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setName(member?.name || "")
    setRole(member?.role || "")
    setPhone(member?.phone || "")
    setEmail(member?.email || "")
    setSpecialization(member?.specialization || "")
    setStatus(member?.status || "Active")
    setNotes(member?.notes || "")
    setError("")
  }, [open, member])

  if (!open) return null

  const submit = async () => {
    setSaving(true)
    setError("")
    try {
      const payload = { name, role, phone, email, specialization, status, notes }
      if (member) await updateStaffMember(member.id, payload)
      else await createStaffMember(payload)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the staff member")
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Staff editor" className="max-h-[88vh] w-full overflow-y-auto rounded-t-xl border bg-white p-5 shadow-lg sm:max-w-lg sm:rounded-xl">
        <h2 className="text-sm font-semibold text-brand-dark">{member ? `Edit ${member.name}` : "Add staff member"}</h2>
        <div className="mt-3 space-y-2.5 text-sm">
          <label className="block text-xs font-medium text-muted-foreground">
            Name *
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" autoFocus />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-muted-foreground">
              Role
              <input value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" placeholder="e.g. Licensed Surveyor" />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                {["Active", "Inactive"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs font-medium text-muted-foreground">
            Specialization
            <input value={specialization} onChange={(e) => setSpecialization(e.target.value)} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" placeholder="e.g. Hydrographic survey, GIS analysis" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-md border px-2.5 py-2 text-sm" />
          </label>
        </div>
        {error && <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !name}
            className="rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
