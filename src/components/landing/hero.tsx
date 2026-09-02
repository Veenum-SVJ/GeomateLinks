import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section id="home" className="relative h-[80vh] min-h-[500px] w-full overflow-hidden">
      <video 
        autoPlay 
        loop 
        muted 
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/images/20250502_123423.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/50"></div>
      <div className="relative z-10 flex h-full items-center justify-center text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Innovative Surveying, Mapping &<br className="hidden md:block" /> GIS Solutions in Nigeria
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-200 md:text-xl">
            Precision, efficiency, and cutting-edge technology for all your geospatial needs.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <a href="#contact">Get a Quote</a>
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-primary">
              <a href="#contact">Contact Us</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
