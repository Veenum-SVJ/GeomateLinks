import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

const projects = [
  { category: "Cadastral", title: "Boundary Survey", image: "https://placehold.co/600x400.png", hint: "cadastral map" },
  { category: "Cadastral", title: "Land Title Registration", image: "https://placehold.co/600x400.png", hint: "land deed" },
  { category: "GIS", title: "Urban Planning Analysis", image: "https://placehold.co/600x400.png", hint: "gis analysis" },
  { category: "GIS", title: "Environmental Impact Assessment", image: "https://placehold.co/600x400.png", hint: "environmental map" },
  { category: "Drone Mapping", title: "Topographic Survey", image: "https://placehold.co/600x400.png", hint: "drone mapping" },
  { category: "Drone Mapping", title: "Construction Monitoring", image: "https://placehold.co/600x400.png", hint: "construction site" },
  { category: "Digitization", title: "Historical Map Archiving", image: "https://placehold.co/600x400.png", hint: "document scan" },
  { category: "Digitization", title: "Utility Network Digitization", image: "https://placehold.co/600x400.png", hint: "network map" },
];

const categories = ["All", "Cadastral", "GIS", "Drone Mapping", "Digitization"];

export function Projects() {
  return (
    <section id="projects" className="bg-secondary/30">
      <div className="container mx-auto">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary md:text-4xl">Our Projects</h2>
          <p className="mt-2 text-lg text-muted-foreground">
            A showcase of our successfully completed work across various domains.
          </p>
        </div>

        <Tabs defaultValue="All" className="w-full">
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
                      <div className="relative h-56 w-full">
                        <Image
                          src={project.image}
                          alt={project.title}
                          layout="fill"
                          objectFit="cover"
                          className="transition-transform duration-300 group-hover:scale-110"
                          data-ai-hint={project.hint}
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
  );
}
