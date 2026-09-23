import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAdmin } from "@/lib/adminStore"
import MediaField from "@/components/admin/MediaField"
import { Plus, Trash2, GripVertical } from "lucide-react"
import { useListDrag } from "@/hooks/useListDrag"
import type { SiteContent } from "@/types/content"

type PageKey = keyof SiteContent["pages"]

export default function PagesPage() {
  const { content, loading, update } = useAdmin()

  if (loading || !content) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-brown border-t-transparent" />
      </div>
    )
  }

  const setHero = (field: keyof SiteContent["hero"], value: string) =>
    update((draft) => {
      draft.hero[field] = value
      return draft
    })

  const setPage = (key: PageKey, field: "label" | "title" | "body", value: string) =>
    update((draft) => {
      draft.pages[key][field] = value
      return draft
    })

  const setStat = (index: number, field: "value" | "label", value: string) =>
    update((draft) => {
      draft.stats[index][field] = value
      return draft
    })

  const setAboutImage = (index: number, url: string) =>
    update((draft) => {
      if (!draft.aboutImages) draft.aboutImages = []
      draft.aboutImages[index] = url
      return draft
    })

  const addAboutImage = () =>
    update((draft) => {
      if (!draft.aboutImages) draft.aboutImages = []
      draft.aboutImages.push("")
      return draft
    })

  const removeAboutImage = (index: number) =>
    update((draft) => {
      draft.aboutImages = (draft.aboutImages ?? []).filter((_, i) => i !== index)
      return draft
    })

  const { dragIndex, handleProps, itemProps } = useListDrag((from, to) =>
    update((draft) => {
      const list = draft.aboutImages ?? []
      const [moved] = list.splice(from, 1)
      list.splice(to, 0, moved)
      draft.aboutImages = list
      return draft
    }),
  )

  const pageMeta: { key: PageKey; name: string; hint: string }[] = [
    { key: "about", name: "About section", hint: "The band below the hero on the homepage." },
    { key: "services", name: "Services section", hint: "Heading above the service list." },
    { key: "projects", name: "Projects section", hint: "Heading above the project grid." },
    { key: "contact", name: "Contact section", hint: "Heading and strapline of the contact area." },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pages</h1>
        <p className="text-sm text-muted-foreground">
          Headings and copy for the homepage. Publish when you are done.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hero (top of homepage)</CardTitle>
          <CardDescription>The first thing visitors read.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="hero-tag">Tag</Label>
            <Input id="hero-tag" value={content.hero.tag} onChange={(e) => setHero("tag", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-top">Headline — first line</Label>
            <Input id="hero-top" value={content.hero.headlineTop} onChange={(e) => setHero("headlineTop", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-accent">Headline — highlighted word</Label>
            <Input id="hero-accent" value={content.hero.headlineAccent} onChange={(e) => setHero("headlineAccent", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-bottom">Headline — last line</Label>
            <Input id="hero-bottom" value={content.hero.headlineBottom} onChange={(e) => setHero("headlineBottom", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-intro">Intro paragraph</Label>
            <Textarea id="hero-intro" rows={3} value={content.hero.intro} onChange={(e) => setHero("intro", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-cta1">Primary button</Label>
            <Input id="hero-cta1" value={content.hero.primaryCta} onChange={(e) => setHero("primaryCta", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-cta2">Secondary button</Label>
            <Input id="hero-cta2" value={content.hero.secondaryCta} onChange={(e) => setHero("secondaryCta", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-cap">Video caption</Label>
            <Input id="hero-cap" value={content.hero.videoCaption} onChange={(e) => setHero("videoCaption", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hero-coords">Video coordinates</Label>
            <Input id="hero-coords" value={content.hero.videoCoords} onChange={(e) => setHero("videoCoords", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {pageMeta.map(({ key, name, hint }) => (
        <Card key={key}>
          <CardHeader>
            <CardTitle>{name}</CardTitle>
            <CardDescription>{hint}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`${key}-label`}>Label</Label>
              <Input id={`${key}-label`} value={content.pages[key].label} onChange={(e) => setPage(key, "label", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${key}-title`}>Title</Label>
              <Input id={`${key}-title`} value={content.pages[key].title} onChange={(e) => setPage(key, "title", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-3">
              <Label htmlFor={`${key}-body`}>Body</Label>
              <Textarea id={`${key}-body`} rows={4} value={content.pages[key].body} onChange={(e) => setPage(key, "body", e.target.value)} />
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Hero video &amp; poster</CardTitle>
          <CardDescription>
            The background video in the hero. If the video URL is empty, the poster image shows instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MediaField
            label="Hero video (MP4)"
            value={content.hero.videoUrl ?? ""}
            onChange={(url) => setHero("videoUrl", url)}
            accept="video/mp4"
          />
          <MediaField
            label="Poster image (fallback when no video)"
            value={content.hero.posterUrl ?? ""}
            onChange={(url) => setHero("posterUrl", url)}
            accept="image/*"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About images</CardTitle>
          <CardDescription>
            Optional photo strip beside the About text. An empty list keeps the section text-only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(content.aboutImages ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              No images — the About section is currently text-only.
            </p>
          )}
          {(content.aboutImages ?? []).map((url, index) => (
            <div
              key={index}
              {...itemProps(index, `about-${index}`)}
              className={`flex items-end gap-2 ${dragIndex === index ? "opacity-50" : ""}`}
            >
              <Button
                variant="ghost"
                size="sm"
                className="mb-1 h-9 w-9 shrink-0 cursor-grab text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
                aria-label={`Drag handle for image ${index + 1}`}
                title="Drag to reorder"
                {...handleProps(`about-${index}`)}
              >
                <GripVertical className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <MediaField
                  label={`Image ${index + 1}`}
                  value={url}
                  onChange={(next) => setAboutImage(index, next)}
                  accept="image/*"
                />
              </div>
              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => removeAboutImage(index)} title="Remove image">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addAboutImage}>
            <Plus className="mr-2 h-4 w-4" /> Add image slot
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hero stats</CardTitle>
          <CardDescription>The numbers under the hero intro.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {content.stats.map((stat, index) => (
            <div key={index} className="space-y-2">
              <Label htmlFor={`stat-${index}`}>Stat {index + 1}</Label>
              <Input id={`stat-${index}`} value={stat.value} onChange={(e) => setStat(index, "value", e.target.value)} />
              <Input value={stat.label} onChange={(e) => setStat(index, "label", e.target.value)} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
