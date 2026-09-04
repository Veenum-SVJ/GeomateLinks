import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAdmin } from "@/lib/adminStore"
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react"

export default function AdminServices() {
  const { content, update } = useAdmin()
  if (!content) return null

  const move = (index: number, direction: -1 | 1) =>
    update((d) => {
      const next = [...d.services]
      const target = index + direction
      if (target < 0 || target >= next.length) return d
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...d, services: next.map((service, i) => ({ ...service, num: String(i + 1).padStart(2, "0") })) }
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
          <p className="text-sm text-muted-foreground">Section heading plus each service line.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            update((d) => ({
              ...d,
              services: [
                ...d.services,
                {
                  id: `service-${Date.now()}`,
                  num: String(d.services.length + 1).padStart(2, "0"),
                  title: "New service",
                  blurb: "",
                  items: [],
                },
              ],
            }))
          }
        >
          <Plus className="mr-2 h-4 w-4" /> Add service
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Section heading</CardTitle>
          <CardDescription>Label and title above the list.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Label</Label>
            <Input
              value={content.pages.services.label}
              onChange={(e) =>
                update((d) => {
                  d.pages.services.label = e.target.value
                  return d
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={content.pages.services.title}
              onChange={(e) =>
                update((d) => {
                  d.pages.services.title = e.target.value
                  return d
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {content.services.map((service, index) => (
        <Card key={service.id}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-base">
                {service.num} — {service.title || "Untitled"}
              </CardTitle>
              <CardDescription>Displayed as one row in the services list.</CardDescription>
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
                onClick={() => update((d) => ({ ...d, services: d.services.filter((_, i) => i !== index) }))}
                aria-label="Delete service"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[100px_1fr]">
              <div className="space-y-2">
                <Label>Number</Label>
                <Input
                  value={service.num}
                  onChange={(e) =>
                    update((d) => {
                      d.services[index].num = e.target.value
                      return d
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={service.title}
                  onChange={(e) =>
                    update((d) => {
                      d.services[index].title = e.target.value
                      return d
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Short description</Label>
              <Textarea
                rows={2}
                value={service.blurb}
                onChange={(e) =>
                  update((d) => {
                    d.services[index].blurb = e.target.value
                    return d
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Detail items (one per line)</Label>
              <Textarea
                rows={4}
                value={service.items.join("\n")}
                onChange={(e) =>
                  update((d) => {
                    d.services[index].items = e.target.value.split("\n").map((line) => line.trim()).filter(Boolean)
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
