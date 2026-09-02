import { Shield, Lightbulb, Users, Leaf, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function About() {
  const values = [
    {
      icon: Shield,
      title: "Integrity",
      description: "Upholding the highest standards of professionalism and ethics in all our engagements.",
    },
    {
      icon: Lightbulb,
      title: "Innovation",
      description: "Leveraging cutting-edge technology to deliver excellent and efficient solutions.",
    },
    {
      icon: Users,
      title: "Client-Centric",
      description: "Placing our clients' needs at the forefront, ensuring tailored and effective outcomes.",
    },
    {
      icon: Leaf,
      title: "Sustainability",
      description: "Promoting practices that support long-term environmental and community well-being.",
    },
  ]

  return (
    <section id="about" className="container mx-auto">
      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-primary md:text-4xl">About Geomate Links Consulting Limited</h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Your trusted partner in geospatial solutions since 2007.
            </p>
          </div>
        
          <div className="space-y-4 text-foreground/90">
            <p>
              Geomate Links Consulting Limited, established in 2007, is a premier indigenous firm in Nigeria specializing in <strong>Surveying, Mapping, and Geographic Information Systems (GIS)</strong>. Our journey began with a mission to provide innovative and reliable geospatial solutions to meet the evolving needs of our clients.
            </p>
            <p>
              We are committed to leveraging cutting-edge technology and a team of seasoned experts to deliver projects with <strong>unparalleled precision and efficiency</strong>. Our work empowers businesses and governments to make informed decisions, optimize resources, and achieve sustainable growth.
            </p>
          </div>

          <div>
            <h3 className="text-2xl font-bold tracking-tight text-primary">Our Core Values</h3>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {values.map((value) => (
                <div key={value.title} className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <value.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{value.title}</h4>
                    <p className="text-sm text-muted-foreground">{value.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4">
            <Button size="lg" className="bg-accent hover:bg-accent/90">
              <a href="#services">
                Explore Our Services <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>

        <div className="relative h-[450px] w-full overflow-hidden rounded-lg shadow-xl lg:h-[550px]">
           <img
            src="/images/20250502_123302.jpg"
            alt="Survey team working in the field"
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          />
        </div>
      </div>
    </section>
  )
}
