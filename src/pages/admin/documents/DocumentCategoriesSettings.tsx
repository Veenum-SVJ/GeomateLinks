// Settings → Document categories manager: create custom categories, rename
// custom ones, delete custom ones (documents keep their name snapshot).
// System categories are protected server-side.
import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Plus, Trash2, Pencil, Loader2, Lock } from "lucide-react"
import { createDocumentCategory, deleteDocumentCategory, fetchDocumentCategories, updateDocumentCategory } from "@/lib/documentsApi"
import type { DocumentCategory } from "@/types/documents"
import { CrmConfirmDialog, CrmErrorState, CrmSpinner } from "@/components/admin/crm/CrmUI"

export default function DocumentCategoriesSettings() {
  const [categories, setCategories] = useState<DocumentCategory[] | null>(null)
  const [error, setError] = useState("")
  const [actionError, setActionError] = useState("")
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<DocumentCategory | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [deleting, setDeleting] = useState<DocumentCategory | null>(null)

  const load = useCallback(async () => {
    setError("")
    try {
      const { categories: rows } = await fetchDocumentCategories()
      setCategories(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load categories")
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!name.trim()) return
    setCreating(true)
    setActionError("")
    try {
      await createDocumentCategory({ name: name.trim() })
      setName("")
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not create the category")
    } finally {
      setCreating(false)
    }
  }

  const rename = async () => {
    if (!renaming || !renameValue.trim()) return
    setActionError("")
    try {
      await updateDocumentCategory(renaming.id, { name: renameValue.trim() })
      setRenaming(null)
      await load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not rename the category")
    }
  }

  const remove = async () => {
    if (!deleting) return
    setActionError("")
    try {
      await deleteDocumentCategory(deleting.id)
      setDeleting(null)
      await load()
    } catch (err) {
      setDeleting(null)
      setActionError(err instanceof Error ? err.message : "Could not delete the category")
    }
  }

  if (error && !categories) return <CrmErrorState message={error} onRetry={load} />
  if (!categories) return <CrmSpinner />

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Document categories</h1>
        <p className="text-sm text-muted-foreground">
          Classify project files. Documents keep a name snapshot, so deleting a category never corrupts history.
        </p>
      </div>

      {actionError && <CrmErrorState message={actionError} onRetry={() => setActionError("")} />}

      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); create() }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name, e.g. Permit"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <button type="submit" disabled={creating || !name.trim()} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90 disabled:opacity-50">
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add
        </button>
      </form>

      <ul className="divide-y rounded-lg border bg-white">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium text-brand-dark">
                {c.name}
                {c.system && <span className="inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground"><Lock className="h-2.5 w-2.5" /> system</span>}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">{c.slug}</p>
            </div>
            {!c.system && (
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => { setRenaming(c); setRenameValue(c.name) }}
                  className="rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => setDeleting(c)}
                  className="rounded-md border px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {renaming && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setRenaming(null) }}>
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-lg border bg-white p-5">
            <h2 className="text-sm font-semibold text-brand-dark">Rename category</h2>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="mt-2 w-full rounded-md border px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRenaming(null)} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
              <button onClick={rename} className="rounded-md bg-brand-brown px-3 py-2 text-sm font-semibold text-white hover:bg-brand-brown/90">Save</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <CrmConfirmDialog
        open={deleting !== null}
        title={`Delete "${deleting?.name}"?`}
        description="Documents keep their category name in history; they will simply lose this classification."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
