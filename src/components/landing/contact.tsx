import { ContactForm } from "./contact-form";
import { Mail, MapPin, Phone, ExternalLink } from "lucide-react";

export function Contact() {
  // Approximate coordinates for Ashi Bodija Road, Ibadan Nigeria
  const lat = 7.4326;
  const lon = 3.9120;
  const bbox = `${lon - 0.01},${lat - 0.005},${lon + 0.01},${lat + 0.005}`;

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

            {/* Map Preview - OpenStreetMap Embed */}
            <div className="space-y-2">
              <div className="relative w-full overflow-hidden rounded-lg border shadow-md" style={{ height: '400px' }}>
                <iframe
                  title="Geomate Links office location"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    border: 0
                  }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <a
                href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Open in OpenStreetMap
              </a>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6 shadow-sm sm:p-8">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
