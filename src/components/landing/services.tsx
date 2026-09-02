import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scaling, Map, Globe2, Archive, Users } from "lucide-react";

const services = [
  {
    icon: Scaling,
    title: "Surveying Services",
    description: "High-precision cadastral, topographic, and engineering surveys using state-of-the-art equipment.",
  },
  {
    icon: Map,
    title: "Mapping Services",
    description: "Comprehensive mapping solutions including satellite imagery analysis, aerial photography, and thematic map production.",
  },
  {
    icon: Globe2,
    title: "GIS & LIS",
    description: "Development of robust Geographic and Land Information Systems for data management, analysis, and visualization.",
  },
  {
    icon: Archive,
    title: "Digitization & Archiving",
    description: "Converting paper maps and records into digital formats for secure, accessible, and efficient data management.",
  },
  {
    icon: Users,
    title: "Corporate Training",
    description: "Specialized training programs in GIS, remote sensing, and modern surveying techniques for organizations.",
  },
];

export function Services() {
  return (
    <section id="services" className="container mx-auto">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-primary md:text-4xl">Our Services</h2>
        <p className="mt-2 text-lg text-muted-foreground">
          Delivering comprehensive geospatial solutions tailored to your needs.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service, index) => (
          <Card key={index} className="flex flex-col text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <CardHeader className="items-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <service.icon className="h-8 w-8" />
              </div>
              <CardTitle className="text-xl">{service.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-muted-foreground">{service.description}</p>
            </CardContent>
          </Card>
        ))}
        {/* No placeholder needed - flex layout handles alignment */}
      </div>
    </section>
  );
}
