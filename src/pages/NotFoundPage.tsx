import { Link } from "react-router-dom"

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream px-4">
      <div className="text-center">
        <h1 className="font-mono text-6xl font-bold text-brand-brown">404</h1>
        <p className="mt-4 text-lg text-brand-warm-gray">Page not found</p>
        <p className="mt-2 text-sm text-brand-warm-gray">The page you are looking for does not exist or has been moved.</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded bg-brand-gold px-4 py-2 font-mono text-xs uppercase tracking-widest text-white transition-colors hover:bg-brand-gold-light">
          Return home
        </Link>
      </div>
    </div>
  )
}
