import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

export function About() {
  const values = [
    "Integrity and Professionalism",
    "Innovation and Excellence",
    "Client-Centric Approach",
    "Sustainable Practices",
  ];

  return (
    <section id="about" className="container mx-auto">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-primary md:text-4xl">About Geomate Links</h2>
            <p className="text-lg text-muted-foreground">
              Your trusted partner in geospatial solutions since 2007.
            </p>
          </div>
          <div className="space-y-4 text-foreground/80">
            <p>
              Geomate Links Consulting Limited, established in 2007, is a premier indigenous firm in Nigeria specializing in Surveying, Mapping, and Geographic Information Systems (GIS). Our journey began with a mission to provide innovative and reliable geospatial solutions to meet the evolving needs of our clients across various sectors.
            </p>
            <p>
              We are committed to leveraging cutting-edge technology and a team of seasoned experts to deliver projects with unparalleled precision and efficiency. Our work empowers businesses and governments to make informed decisions, optimize resources, and achieve sustainable growth.
            </p>
          </div>
          <Card className="bg-secondary/50">
            <CardHeader>
              <CardTitle className="text-primary">Our Core Values</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {values.map((value) => (
                  <li key={value} className="flex items-start">
                    <CheckCircle className="mr-2 mt-1 h-5 w-5 flex-shrink-0 text-accent" />
                    <span>{value}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        <div className="relative h-[500px] w-full overflow-hidden rounded-lg shadow-xl">
           <Image
            src="https://placehold.co/800x600.png"
            alt="Geomate Links Team"
            layout="fill"
            objectFit="cover"
            className="transition-transform duration-500 hover:scale-105"
            data-ai-hint="office team"
          />
        </div>
      </div>
    </section>
  );
}
