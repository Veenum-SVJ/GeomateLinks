import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import MediaField from "@/components/admin/MediaField"
import { useAdmin } from "@/lib/adminStore"
import { Plus, Trash2 } from "lucide-react"

export default function AdminHomePage() {
  const { content, update } = useAdmin()
  if (!content) return null

  const hero = content.hero
  const aboutImages = content.aboutImages ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Home page</h1>
        <p className="text-sm text-muted-foreground">Hero, statistics, and the about section.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hero</CardTitle>
          <CardDescription>Headline is shown on three lines; the middle line is gold.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tagline</Label>
            <Input value={hero.tag} onChange={(e) => update((d) => ({ ...d, hero: { ...d.hero, tag: e.target.value } }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Headline line 1</Label>
              <Input value={hero.headlineTop} onChange={(e) => update((d) => ({ ...d, hero: { ...d.hero, headlineTop: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>Headline line 2 (gold)</Label>
              <Input value={hero.headlineAccent} onChange={(e) => update((d) => ({ ...d, hero: { ...d.hero, headlineAccent: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>Headline line 3</Label>
              <Input value={hero.headlineBottom} onChange={(e) => update((d) => ({ ...d, hero: { ...d.hero, headlineBottom: e.target.value } }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Intro paragraph</Label>
            <Textarea rows={3} value={hero.intro} onChange={(e) => update((d) => ({ ...d, hero: { ...d.hero, intro: e.target.value } }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Primary button</Label>
              <Input value={hero.primaryCta} onChange={(e) => update((d) => ({ ...d, hero: { ...d.hero, primaryCta: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>Secondary button</Label>
              <Input value={hero.secondaryCta} onChange={(e) => update((d) => ({ ...d, hero: { ...d.hero, secondaryCta: e.target.value } }))} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Video caption</Label>
              <Input value={hero.videoCaption} onChange={(e) => update((d) => ({ ...d, hero: { ...d.hero, videoCaption: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label>Coordinates label</Label>
              <Input value={hero.videoCoords} onChange={(e) => update((d) => ({ ...d, hero: { ...d.hero, videoCoords: e.target.value } }))} />
            </div>
          </div>
          <MediaField
            label="Hero video (mp4)"
            accept="video/mp4"
            value={hero.videoUrl ?? ""}
            onChange={(url) => update((d) => ({ ...d, hero: { ...d.hero, videoUrl: url } }))}
          />
          <MediaField
            label="Hero poster image"
            accept="image/*"
            value={hero.posterUrl ?? ""}
            onChange={(url) => update((d) => ({ ...d, hero: { ...d.hero, posterUrl: url } }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Statistics</CardTitle>
            <CardDescription>Shown under the hero copy.</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => update((d) => ({ ...d, stats: [...d.stats, { value: "", label: "" }] }))}
          >
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {content.stats.map((stat, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
              <Input
                value={stat.value}
                placeholder="2007"
                onChange={(e) =>
                  update((d) => {
                    d.stats[index].value = e.target.value
                    return d
                  })
                }
              />
              <Input
                value={stat.label}
                placeholder="Established"
                onChange={(e) =>
                  update((d) => {
                    d.stats[index].label = e.target.value
                    return d
                  })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => update((d) => ({ ...d, stats: d.stats.filter((_, i) => i !== index) }))}
                aria-label="Remove stat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About section</CardTitle>
          <CardDescription>Section heading and body paragraphs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Section label</Label>
              <Input
                value={content.pages.about.label}
                onChange={(e) =>
                  update((d) => {
                    d.pages.about.label = e.target.value
                    return d
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Section title</Label>
              <Input
                value={content.pages.about.title}
                onChange={(e) =>
                  update((d) => {
                    d.pages.about.title = e.target.value
                    return d
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Intro paragraph</Label>
            <Textarea
              rows={3}
              value={content.pages.about.body}
              onChange={(e) =>
                update((d) => {
                  d.pages.about.body = e.target.value
                  return d
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Corporate information</Label>
            <Textarea
              rows={4}
              value={content.company.corporateInfo}
              onChange={(e) =>
                update((d) => {
                  d.company.corporateInfo = e.target.value
                  return d
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Human resources paragraph</Label>
            <Textarea
              rows={3}
              value={content.company.humanResources}
              onChange={(e) =>
                update((d) => {
                  d.company.humanResources = e.target.value
                  return d
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>About images</CardTitle>
            <CardDescription>Grid of photos beside the about text.</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => update((d) => ({ ...d, aboutImages: [...(d.aboutImages ?? []), ""] }))}
          >
            <Plus className="mr-2 h-4 w-4" /> Add image
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {aboutImages.map((src, index) => (
            <div key={index} className="space-y-2 rounded-md border border-border p-3">
              <MediaField
                label={`Image ${index + 1}`}
                value={src}
                onChange={(url) =>
                  update((d) => {
                    const list = [...(d.aboutImages ?? [])]
                    list[index] = url
                    return { ...d, aboutImages: list }
                  })
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => update((d) => ({ ...d, aboutImages: (d.aboutImages ?? []).filter((_, i) => i !== index) }))}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
