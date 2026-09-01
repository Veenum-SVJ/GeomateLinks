import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"

const projects = [
  { category: "Cadastral", title: "Boundary Survey", image: "/images/20250502_123312.jpg" },
  { category: "Cadastral", title: "Land Title Registration", image: "/images/20250502_123315.jpg" },
  { category: "GIS", title: "Urban Planning Analysis", image: "/images/20250502_135454.jpg" },
  { category: "GIS", title: "Environmental Impact Assessment", image: "/images/20250502_160800.jpg" },
  { category: "Drone Mapping", title: "Topographic Survey", image: "/images/20260819_130339.jpg" },
  { category: "Drone Mapping", title: "Construction Monitoring", image: "/images/20260819_131151.jpg" },
  { category: "Digitization", title: "Historical Map Archiving", image: "/images/20260819_131304.jpg" },
  { category: "Digitization", title: "Utility Network Digitization", image: "/images/20260819_131307.jpg" },
]

const categories = ["All", "Cadastral", "GIS", "Drone Mapping", "Digitization"]

export function Projects() {
  const [activeTab, setActiveTab] = useState("All")

  return (
    <section id="projects" className="bg-secondary/30">
      <div className="container mx-auto">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary md:text-4xl">Our Projects</h2>
          <p className="mt-2 text-lg text-muted-foreground">
            A showcase of our successfully completed work across various domains.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
            {categories.map((category) => (
              <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
            ))}
          </TabsList>

          {categories.map((category) => (
            <TabsContent key={category} value={category} className="mt-8">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(category === "All"
                  ? projects
                  : projects.filter((p) => p.category === category)
                ).map((project, index) => (
                  <Card key={`${project.title}-${index}`} className="overflow-hidden group">
                    <CardContent className="p-0">
                      <div className="relative h-56 w-full overflow-hidden">
                        <img
                          src={project.image}
                          alt={project.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}
