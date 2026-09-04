import { Link } from "react-router-dom"
import { useState, useEffect, type FormEvent, type ChangeEvent } from "react"
import useSEO from "@/hooks/useSEO"
import type { Project } from "@/data/index"
import content from "@/data/content.json"

useSEO()

const HERO_VIDEO = "/media/hero.mp4"
const HERO_POSTER = "/media/hero-poster.jpg"
const ABOUT_IMAGES = [
  "/media/20250502_123302-800.jpg",
  "/media/20250502_123312-800.jpg",
  "/media/20250502_123315-800.jpg",
  "/media/20250502_123348-800.jpg",
  "/media/20250502_135454-800.jpg",
  "/media/20250502_160800-800.jpg",
  "/media/20260819_131304-800.jpg",
  "/media/20260819_131307-800.jpg",
]

const FOOTER_LINKS = [
  { label: "Privacy", href: "#" },
  { label: "Terms", href: "#" },
  { label: "SURCON Registered", href: "#" },
]

const MAP_SRC = content.company.mapEmbed

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" })

  const projects: Project[] = content.projects
  const totalSlides = Math.max(1, Math.ceil(projects.length / 4))

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(maxScroll > 0 ? Math.min((scrolled / maxScroll) * 100, 100) : 0)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const goToSlide = (index: number) => setCurrentSlide(Math.max(0, Math.min(index, totalSlides - 1)))
  const visibleProjects = projects.slice(currentSlide * 4, currentSlide * 4 + 4)

  const updateField = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    window.location.href = `mailto:${content.company.emails[0]}?subject=${encodeURIComponent(form.subject || "New website enquiry")}&body=${encodeURIComponent(form.message || form.name + "\n" + form.email + "\n" + form.phone)}`
  }

  return (
    <div className="min-h-screen bg-brand-cream text-brand-dark">
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-progress">
            <div className="nav-progress-fill" style={{ width: `${scrollProgress}%` }} />
          </div>
          <Link to="/" className="flex items-center gap-3 no-underline">
            <div className="logo-mark">GL</div>
            <span className="font-mono text-sm font-bold tracking-tight text-brand-dark">GEOMATE LINKS</span>
          </Link>
          <ul className="nav-links">
            <li><a href="#about" className="font-mono text-xs uppercase tracking-widest text-brand-warm-gray hover:text-brand-brown transition-colors">About</a></li>
            <li><a href="#services" className="font-mono text-xs uppercase tracking-widest text-brand-warm-gray hover:text-brand-brown transition-colors">Services</a></li>
            <li><a href="#projects" className="font-mono text-xs uppercase tracking-widest text-brand-warm-gray hover:text-brand-brown transition-colors">Projects</a></li>
            <li><a href="#contact" className="font-mono text-xs uppercase tracking-widest text-brand-warm-gray hover:text-brand-brown transition-colors">Contact</a></li>
            <li><a href="#contact" className="nav-cta">Get Quote</a></li>
          </ul>
        </div>
      </nav>

      <section className="hero relative overflow-hidden border-b-2 border-brand-dark bg-brand-cream">
        <div className="absolute inset-y-0 right-0 w-11/12 sm:w-3/5 bg-brand-dark" style={{ clipPath: "polygon(12% 0, 100% 0, 100% 100%, 0% 100%)" }} />
        <div className="relative z-10 max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-16 items-center py-16 sm:py-24 px-4 sm:px-6">
          <div className="hero-text">
            <div className="hero-tag font-mono text-[0.6875rem] tracking-[0.2em] uppercase text-brand-gold flex items-center gap-2">
              <span className="inline-block h-2 w-6 bg-brand-gold" />
              {content.hero.tag}
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.75rem] font-semibold tracking-tight text-brand-dark leading-[1.05] mb-6">
              {content.hero.headlineTop}
              <br />
              <span className="text-brand-gold">{content.hero.headlineAccent}</span>
              <br />
              {content.hero.headlineBottom}
            </h1>
            <p className="text-base sm:text-lg text-brand-warm-gray leading-relaxed max-w-md mb-8 text-balance">
              {content.hero.intro}
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#contact" className="btn btn-primary">Request a Quote</a>
              <a href="#services" className="btn btn-outline">Our Services</a>
            </div>
            <div className="mt-10 flex flex-wrap gap-10 border-t border-black/10 pt-6">
              {content.stats.map((item) => (
                <div key={item.value} className="stat">
                  <div className="font-mono text-[1.75rem] font-bold text-brand-gold leading-none">{item.value}</div>
                  <div className="text-xs text-brand-warm-gray uppercase tracking-[0.1em] mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image relative rounded border-2 border-brand-dark overflow-hidden">
              <video className="w-full aspect-[4/3] object-cover" autoPlay loop muted playsInline poster={HERO_POSTER}>
                <source src={HERO_VIDEO} type="video/mp4" />
              </video>
              <div className="hero-image-overlay absolute inset-x-0 bottom-0 bg-brand-dark/90 px-4 py-3 flex items-center justify-between">
                <span className="font-mono text-[0.6875rem] text-white/60 tracking-[0.1em]">{content.hero.videoCaption}</span>
                <span className="font-mono text-[0.6875rem] text-white/60 tracking-[0.1em]">{content.hero.videoCoords}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section bg-white border-t-2 border-b-2 border-brand-dark" id="about">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            <div>
              <span className="section-label">{content.pages.about.label}</span>
              <h2 className="section-title mb-6">{content.pages.about.title}</h2>
              <p className="text-brand-warm-gray leading-relaxed mb-4">{content.company.corporateInfo}</p>
              <p className="text-brand-warm-gray leading-relaxed mb-4">{content.company.humanResources}</p>
              <div className="mt-4 space-y-2">
                <p className="font-mono text-xs uppercase tracking-widest text-brand-gold">Registered details</p>
                <p className="text-sm text-brand-warm-gray">CAC registration: RC746106. Date of incorporation: November 2007.</p>
                <p className="text-sm text-brand-warm-gray">Principal office: {content.company.address.suite}, {content.company.address.street}, {content.company.address.city}.</p>
                <p className="text-sm text-brand-warm-gray">Postal address: {content.company.address.postal}</p>
              </div>
            </div>
            <div className="about-image-grid grid grid-cols-2 gap-3">
              {ABOUT_IMAGES.map((src, index) => (
                <img key={src} src={src} alt={`Geomate Links field record ${index + 1}`} loading="lazy" className="w-full aspect-square object-cover rounded border border-black/10" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="services">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <span className="section-label">{content.pages.services.label}</span>
          <h2 className="section-title mb-10">{content.pages.services.title}</h2>
          <p className="text-brand-warm-gray max-w-2xl mb-10">{content.pages.services.body}</p>
          <div className="services-list">
            {content.services.map((service) => (
              <div key={service.id} className="service-row">
                <span className="service-num font-mono text-xs text-brand-gold tracking-[0.1em]">{service.num}</span>
                <div>
                  <h3 className="font-display text-xl font-semibold text-brand-dark tracking-tight">{service.title}</h3>
                  <p className="text-sm text-brand-warm-gray mt-1 hidden sm:block">{service.blurb}</p>
                </div>
                <p className="text-sm text-brand-warm-gray leading-relaxed hidden lg:block">{service.items.join(" · ")}</p>
                <span className="service-arrow">→</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-brand-dark text-white" id="projects">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <span className="section-label">{content.pages.projects.label}</span>
              <h2 className="section-title text-white">{content.pages.projects.title}</h2>
              <p className="text-white/60 mt-2 max-w-xl">{content.pages.projects.body}</p>
            </div>
            <div className="projects-nav flex items-center gap-3">
              <button type="button" className="projects-nav-btn" onClick={() => goToSlide(currentSlide - 1)} disabled={currentSlide === 0} aria-label="Previous projects">←</button>
              <div className="projects-dots flex items-center gap-2">
                {Array.from({ length: totalSlides }).map((_, index) => (
                  <button key={index} type="button" className={`projects-dot h-2 w-2 rounded-full border-none transition-all ${index === currentSlide ? "bg-brand-gold scale-125" : "bg-white/20"}`} onClick={() => goToSlide(index)} aria-label={`Projects page ${index + 1}`} />
                ))}
              </div>
              <button type="button" className="projects-nav-btn" onClick={() => goToSlide(currentSlide + 1)} disabled={currentSlide === totalSlides - 1} aria-label="Next projects">→</button>
            </div>
          </div>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleProjects.map((project) => (
              <article key={project.id} className="project-item">
                <img src={project.image} alt={project.alt} loading="lazy" />
                <div className="project-overlay">
                  <span className="project-category font-mono text-[0.625rem] uppercase tracking-[0.2em] text-brand-gold">{project.category}</span>
                  <span className="project-title font-display text-base sm:text-lg font-semibold text-white mt-1">{project.title}</span>
                  <span className="text-white/60 text-xs mt-1">{project.location} · {project.status}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="contact">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            <div>
              <span className="section-label">{content.pages.contact.label}</span>
              <h2 className="section-title mb-3">{content.pages.contact.title}</h2>
              <p className="text-brand-warm-gray mb-8">{content.pages.contact.body}</p>
              <div className="space-y-0">
                <div className="contact-row flex justify-between border-b border-black/10 py-3 text-sm">
                  <span className="label font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-brand-warm-gray">Address</span>
                  <span className="value text-brand-dark font-medium">{content.company.address.suite}, {content.company.address.street}, {content.company.address.city}, {content.company.address.state}</span>
                </div>
                <div className="contact-row flex justify-between border-b border-black/10 py-3 text-sm">
                  <span className="label font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-brand-warm-gray">Phone</span>
                  <span className="value font-medium">{content.company.phones.join(" · ")}</span>
                </div>
                <div className="contact-row flex justify-between border-b border-black/10 py-3 text-sm">
                  <span className="label font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-brand-warm-gray">Email</span>
                  <span className="value"><a href={`mailto:${content.company.emails[0]}`} className="text-brand-gold underline decoration-1 underline-offset-2">{content.company.emails[0]}</a></span>
                </div>
                <div className="contact-row flex justify-between border-b border-black/10 py-3 text-sm">
                  <span className="label font-mono text-[0.6875rem] uppercase tracking-[0.1em] text-brand-warm-gray">Hours</span>
                  <span className="value font-medium">{content.company.hours}</span>
                </div>
              </div>
              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input name="name" value={form.name} onChange={updateField} placeholder="Full name" className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
                  <input name="email" value={form.email} onChange={updateField} placeholder="Email" type="email" className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <input name="phone" value={form.phone} onChange={updateField} placeholder="Phone" className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
                <input name="subject" value={form.subject} onChange={updateField} placeholder="Subject" className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
                <textarea name="message" value={form.message} onChange={updateField} placeholder="Project details" rows={4} className="w-full rounded border border-input bg-background px-3 py-2 text-sm" />
                <button type="submit" className="btn btn-primary w-full justify-center">Send Enquiry</button>
              </form>
            </div>
            <div className="contact-map">
              <iframe src={MAP_SRC} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Geomate Links office location on Google Maps" />
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-brand-dark text-white/40 border-t-2 border-brand-gold">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="font-mono text-xs uppercase tracking-[0.1em]">Geomate Links <span className="text-brand-gold">Consulting Ltd</span> — Est. 2007</div>
          <nav className="flex gap-6" aria-label="Footer">
            {FOOTER_LINKS.map((item) => (
              <a key={item.label} href={item.href} className="font-mono text-[0.6875rem] uppercase tracking-[0.1em] hover:text-brand-gold transition-colors">{item.label}</a>
            ))}
          </nav>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-2">
            <span className="text-xs">&copy; {new Date().getFullYear()} Geomate Links Consulting Limited. All rights reserved.</span>
            <span className="text-xs">Registered with SURCON · RC746106</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
