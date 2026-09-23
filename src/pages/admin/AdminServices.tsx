import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAdmin } from "@/lib/adminStore"
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react"
import type { Service } from "@/types/content"

export default function AdminServices() {
  const { content, loading, update } = useAdmin()

  if (loading || !content) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-brown border-t-transparent" />
      </div>
    )
  }

  const mutate = (fn: (services: Service[]) => void) =>
    update((draft) => {
      fn(draft.services)
      return draft
    })

  const setField = (index: number, field: keyof Service, value: string) =>
    mutate((services) => {
      if (field === "items") return
      ;(services[index][field] as string) = value
    })

  const setItems = (index: number, value: string) =>
    mutate((services) => {
      services[index].items = value.split("\n").map((line) => line.trim()).filter(Boolean)
    })

  const move = (index: number, delta: number) =>
    mutate((services) => {
      const target = index + delta
      if (target < 0 || target >= services.length) return
      ;[services[index], services[target]] = [services[target], services[index]]
    })

  const remove = (index: number) =>
    mutate((services) => {
      services.splice(index, 1)
    })

  const add = () =>
    mutate((services) => {
      services.push({
        id: `svc-${Date.now().toString(36)}`,
        num: String(services.length + 1).padStart(2, "0"),
        title: "New service",
        blurb: "",
        items: [],
      })
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
          <p className="text-sm text-muted-foreground">The service list shown on the homepage. Publish when done.</p>
        </div>
        <Button onClick={add}>
          <Plus className="mr-2 h-4 w-4" /> Add service
        </Button>
      </div>

      {content.services.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No services yet — add the first one.
          </CardContent>
        </Card>
      )}

      {content.services.map((service, index) => (
        <Card key={service.id || index}>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Service {index + 1}</CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => move(index, -1)} disabled={index === 0} title="Move up">
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => move(index, 1)} disabled={index === content.services.length - 1} title="Move down">
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(index)} className="text-red-600 hover:bg-red-50" title="Remove">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`svc-num-${index}`}>Number</Label>
              <Input id={`svc-num-${index}`} value={service.num} onChange={(e) => setField(index, "num", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`svc-title-${index}`}>Title</Label>
              <Input id={`svc-title-${index}`} value={service.title} onChange={(e) => setField(index, "title", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-3">
              <Label htmlFor={`svc-blurb-${index}`}>Short description</Label>
              <Textarea id={`svc-blurb-${index}`} rows={2} value={service.blurb} onChange={(e) => setField(index, "blurb", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-3">
              <Label htmlFor={`svc-items-${index}`}>Bullet items (one per line)</Label>
              <Textarea
                id={`svc-items-${index}`}
                rows={Math.max(3, service.items.length)}
                value={service.items.join("\n")}
                onChange={(e) => setItems(index, e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
