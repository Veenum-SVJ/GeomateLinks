import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"

const projects = [
  { category: "Cadastral", title: "Boundary Survey", description: "Precise land boundary determination and demarcation", image: "/images/20250502_123312.jpg" },
  { category: "Cadastral", title: "Land Title Registration", description: "Complete documentation and registration services", image: "/images/20250502_123315.jpg" },
  { category: "GIS", title: "Urban Planning Analysis", description: "Comprehensive city planning and development analysis", image: "/images/20250502_135454.jpg" },
  { category: "GIS", title: "Environmental Impact Assessment", description: "EIA studies for sustainable development projects", image: "/images/20250502_160800.jpg" },
  { category: "Drone Mapping", title: "Topographic Survey", description: "High-precision aerial topographic mapping", image: "/images/20260819_130339.jpg" },
  { category: "Drone Mapping", title: "Construction Monitoring", description: "Progress tracking and quality assurance", image: "/images/20260819_131151.jpg" },
  { category: "Digitization", title: "Historical Map Archiving", description: "Preservation and digitization of historical records", image: "/images/20260819_131304.jpg" },
  { category: "Digitization", title: "Utility Network Digitization", description: "Mapping and documenting utility infrastructure", image: "/images/20260819_131307.jpg" },
]

const categories = ["All", "Cadastral", "GIS", "Drone Mapping", "Digitization"]

export function Projects() {
  const [activeTab, setActiveTab] = useState("All")

  return (
    <section id="projects" className="bg-secondary/30 py-16">
      <div className="container mx-auto px-4">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary md:text-4xl">Our Projects</h2>
          <p className="mt-2 text-lg text-muted-foreground">
            A showcase of our successfully completed work across various domains.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-5 mb-8">
            {categories.map((category) => (
              <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
            ))}
          </TabsList>

          {categories.map((category) => (
            <TabsContent key={category} value={category} className="mt-0">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(category === "All"
                  ? projects
                  : projects.filter((p) => p.category === category)
                ).map((project, index) => (
                  <Card key={`${project.title}-${index}`} className="overflow-hidden group hover:shadow-lg transition-shadow">
                    <CardContent className="p-0">
                      <div className="relative h-56 w-full overflow-hidden">
                        <img
                          src={project.image}
                          alt={`${project.title} - ${project.description}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <h3 className="text-white font-semibold">{project.title}</h3>
                          <p className="text-white/80 text-sm">{project.description}</p>
                        </div>
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
