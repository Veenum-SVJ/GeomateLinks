import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAdmin } from "@/lib/adminStore"
import MediaField from "@/components/admin/MediaField"
import ConfirmDialog from "@/components/admin/ConfirmDialog"
import { Plus, Trash2, ArrowUp, ArrowDown, GripVertical } from "lucide-react"
import { useListDrag } from "@/hooks/useListDrag"
import type { Project } from "@/types/content"

export default function AdminProjects() {
  const { content, loading, update } = useAdmin()
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null)

  const { dragIndex, handleProps, itemProps } = useListDrag((from, to) =>
    update((draft) => {
      const [moved] = draft.projects.splice(from, 1)
      draft.projects.splice(to, 0, moved)
      return draft
    }),
  )

  if (loading || !content) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-brown border-t-transparent" />
      </div>
    )
  }

  const mutate = (fn: (projects: Project[]) => void) =>
    update((draft) => {
      fn(draft.projects)
      return draft
    })

  const setField = (index: number, field: keyof Project, value: string) =>
    mutate((projects) => {
      ;(projects[index][field] as string) = value
    })

  const move = (index: number, delta: number) =>
    mutate((projects) => {
      const target = index + delta
      if (target < 0 || target === projects.length) return
      ;[projects[index], projects[target]] = [projects[target], projects[index]]
    })

  const remove = (index: number) =>
    mutate((projects) => {
      projects.splice(index, 1)
    })

  const add = () =>
    mutate((projects) => {
      projects.push({
        id: `prj-${Date.now().toString(36)}`,
        title: "New project",
        category: "",
        location: "",
        status: "",
        image: "",
        alt: "",
      })
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">The portfolio grid on the homepage. Publish when done.</p>
        </div>
        <Button onClick={add}>
          <Plus className="mr-2 h-4 w-4" /> Add project
        </Button>
      </div>

      {content.projects.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No projects yet — add the first one.
          </CardContent>
        </Card>
      )}

      {content.projects.map((project, index) => (
        <Card
          key={project.id || index}
          {...itemProps(index, project.id || `idx-${index}`)}
          className={dragIndex === index ? "opacity-50" : undefined}
        >
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{project.title || `Project ${index + 1}`}</CardTitle>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="cursor-grab text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
                  aria-label={`Drag handle for project ${index + 1}`}
                  title="Drag to reorder"
                  {...handleProps(project.id || `idx-${index}`)}
                >
                  <GripVertical className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => move(index, -1)} disabled={index === 0} title="Move up">
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => move(index, 1)} disabled={index === content.projects.length - 1} title="Move down">
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(index)} className="text-red-600 hover:bg-red-50" title="Remove">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`prj-title-${index}`}>Title</Label>
              <Input id={`prj-title-${index}`} value={project.title} onChange={(e) => setField(index, "title", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`prj-cat-${index}`}>Category</Label>
              <Input id={`prj-cat-${index}`} value={project.category} onChange={(e) => setField(index, "category", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`prj-loc-${index}`}>Location</Label>
              <Input id={`prj-loc-${index}`} value={project.location} onChange={(e) => setField(index, "location", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`prj-status-${index}`}>Status</Label>
              <Input id={`prj-status-${index}`} value={project.status} onChange={(e) => setField(index, "status", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`prj-alt-${index}`}>Image description (alt text)</Label>
              <Input id={`prj-alt-${index}`} value={project.alt} onChange={(e) => setField(index, "alt", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <MediaField
                label="Project image"
                value={project.image}
                onChange={(url) => setField(index, "image", url)}
              />
            </div>          </CardContent>
        </Card>
      ))}

      <ConfirmDialog
        open={confirmRemove !== null}
        title={`Remove project ${confirmRemove !== null ? confirmRemove + 1 : ""}?`}
        description={`"${confirmRemove !== null ? content.projects[confirmRemove]?.title : ""}" will disappear from the homepage portfolio after you publish. This opens the standard publish flow, so you can discard before publishing if it was a mistake.`}
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirmRemove !== null) remove(confirmRemove)
          setConfirmRemove(null)
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  )
}
