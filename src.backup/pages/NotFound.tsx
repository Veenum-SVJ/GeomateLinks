import { MapPin, Mail } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <div className="mb-8 inline-flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
            <span className="text-5xl font-bold text-primary">404</span>
          </div>
          <h1 className="mb-4 text-3xl font-bold tracking-tight text-primary">Page Not Found</h1>
          <p className="mb-8 text-lg text-muted-foreground">
            Sorry, we couldn't find the page you're looking for. It might have been moved or deleted.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Return Home
            </a>
            <a
              href="mailto:geomatelinks@gmail.com"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Contact Support
            </a>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <MapPin className="mb-2 h-5 w-5 text-primary" />
              <p className="text-sm font-medium">Visit Our Office</p>
              <p className="text-sm text-muted-foreground">Josbeed Mall, Ashi Bodija Road, Ibadan</p>
            </div>
            <div className="rounded-lg border p-4">
              <Mail className="mb-2 h-5 w-5 text-primary" />
              <p className="text-sm font-medium">Email Us</p>
              <p className="text-sm text-muted-foreground">geomatelinks@gmail.com</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
