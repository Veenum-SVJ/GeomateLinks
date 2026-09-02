import { Mail, MapPin, Phone } from "lucide-react"
import { ContactForm } from "./contact-form"

export function Contact() {
  return (
    <section id="contact" className="bg-secondary/30">
      <div className="container mx-auto">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-primary md:text-4xl">Get In Touch</h2>
          <p className="mt-2 text-lg text-muted-foreground">
            We're here to help. Contact us for a quote or any inquiries.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-8">
            <div>
              <h3 className="text-2xl font-semibold text-primary">Contact Information</h3>
              <p className="mt-1 text-muted-foreground">
                Fill up the form and our team will get back to you within 24 hours.
              </p>
            </div>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-semibold">Phone</h4>
                  <p className="text-muted-foreground">+234 803 334 1424</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-semibold">Email</h4>
                  <p className="text-muted-foreground">geomatelinks@gmail.com</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <MapPin className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-semibold">Address</h4>
                  <p className="text-muted-foreground">Josbeed Mall Ashi Bodija Road Ibadan North LGA, Ibadan Nigeria</p>
                </div>
              </div>
            </div>
            <div 
              className="h-64 w-full rounded-lg bg-cover bg-center shadow-md lg:h-80"
              style={{ backgroundImage: "url('/images/20250502_123348.jpg')" }}
              aria-label="Company location map"
            ></div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  )
}
