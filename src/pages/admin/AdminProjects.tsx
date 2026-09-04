import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import MediaField from "@/components/admin/MediaField"
import { useAdmin } from "@/lib/adminStore"
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react"

export default function AdminProjects() {
  const { content, update } = useAdmin()
  if (!content) return null

  const move = (index: number, direction: -1 | 1) =>
    update((d) => {
      const next = [...d.projects]
      const target = index + direction
      if (target < 0 || target >= next.length) return d
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...d, projects: next }
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            The website shows four projects per page — {content.projects.length} project(s) currently, across{" "}
            {Math.max(1, Math.ceil(content.projects.length / 4))} page(s).
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            update((d) => ({
              ...d,
              projects: [
                {
                  id: `project-${Date.now()}`,
                  title: "New project",
                  category: "",
                  location: "",
                  status: "Completed",
                  image: "",
                  thumb: "",
                  alt: "",
                },
                ...d.projects,
              ],
            }))
          }
        >
          <Plus className="mr-2 h-4 w-4" /> Add project
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Section heading</CardTitle>
          <CardDescription>Label, title and intro above the gallery.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={content.pages.projects.label}
                onChange={(e) =>
                  update((d) => {
                    d.pages.projects.label = e.target.value
                    return d
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={content.pages.projects.title}
                onChange={(e) =>
                  update((d) => {
                    d.pages.projects.title = e.target.value
                    return d
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Intro</Label>
            <Textarea
              rows={2}
              value={content.pages.projects.body}
              onChange={(e) =>
                update((d) => {
                  d.pages.projects.body = e.target.value
                  return d
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {content.projects.map((project, index) => (
        <Card key={project.id}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{project.title || "Untitled project"}</CardTitle>
              <CardDescription>
                Page {Math.floor(index / 4) + 1} · position {(index % 4) + 1}
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => move(index, -1)} aria-label="Move up">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => move(index, 1)} aria-label="Move down">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => update((d) => ({ ...d, projects: d.projects.filter((_, i) => i !== index) }))}
                aria-label="Delete project"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={project.title}
                onChange={(e) =>
                  update((d) => {
                    d.projects[index].title = e.target.value
                    return d
                  })
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={project.category}
                  onChange={(e) =>
                    update((d) => {
                      d.projects[index].category = e.target.value
                      return d
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={project.location}
                  onChange={(e) =>
                    update((d) => {
                      d.projects[index].location = e.target.value
                      return d
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Input
                  value={project.status}
                  onChange={(e) =>
                    update((d) => {
                      d.projects[index].status = e.target.value
                      return d
                    })
                  }
                />
              </div>
            </div>
            <MediaField
              label="Project image"
              value={project.thumb || project.image}
              onChange={(url) =>
                update((d) => {
                  d.projects[index].image = url
                  d.projects[index].thumb = url
                  return d
                })
              }
            />
            <div className="space-y-2">
              <Label>Alt text (accessibility)</Label>
              <Textarea
                rows={2}
                value={project.alt}
                onChange={(e) =>
                  update((d) => {
                    d.projects[index].alt = e.target.value
                    return d
                  })
                }
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
