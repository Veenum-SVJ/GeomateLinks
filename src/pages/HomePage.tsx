import { Link } from "react-router-dom"
import { useState, useEffect, type FormEvent, type ChangeEvent } from "react"
import useSEO from "@/hooks/useSEO"
import { useSiteContent } from "@/hooks/useSiteContent"
import { submitMessage } from "@/lib/api"

const FOOTER_LINKS = [
  { label: "About", href: "#about" },
  { label: "Services", href: "#services" },
  { label: "Projects", href: "#projects" },
  { label: "Contact", href: "#contact" },
]

const EMPTY_FORM = { name: "", email: "", phone: "", subject: "", message: "" }

export default function HomePage() {
  useSEO()
  const { content } = useSiteContent()

  const [currentSlide, setCurrentSlide] = useState(0)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [form, setForm] = useState(EMPTY_FORM)
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")

  const projects = content.projects ?? []
  const totalSlides = Math.max(1, Math.ceil(projects.length / 4))
  const visibleProjects = projects.slice(currentSlide * 4, currentSlide * 4 + 4)
  const aboutImages = content.aboutImages ?? []

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(maxScroll > 0 ? Math.min((scrolled / maxScroll) * 100, 100) : 0)
    }
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    setCurrentSlide(0)
  }, [projects.length])

  const goToSlide = (index: number) => setCurrentSlide(Math.max(0, Math.min(index, totalSlides - 1)))

  const updateField = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setStatus("sending")
    setStatusMessage("")

    try {
      await submitMessage(form)
      setStatus("sent")
      setStatusMessage("Thank you. Your enquiry has been received.")
      setForm(EMPTY_FORM)
    } catch (error) {
      setStatus("error")
      setStatusMessage(error instanceof Error ? error.message : "Could not send message")
    }
  }

  return (
    <div className="min-h-screen bg-brand-cream text-brand-dark">
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-progress">
            <div className="nav-progress-fill" style={{ width: `${scrollProgress}%` }} />
          </div>
          <a href="#top" className="logo">
            <div className="logo-mark">GL</div>
            GEOMATE LINKS
          </a>
          <ul className="nav-links">
            <li><a href="#about">About</a></li>
            <li><a href="#services">Services</a></li>
            <li><a href="#projects">Projects</a></li>
            <li><a href="#contact">Contact</a></li>
            <li><a href="#contact" className="nav-cta">Get Quote</a></li>
          </ul>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-grid">
          <div className="hero-text">
            <div className="hero-tag">{content.hero.tag}</div>
            <h1>
              {content.hero.headlineTop}
              <br />
              <span>{content.hero.headlineAccent}</span>
              <br />
              {content.hero.headlineBottom}
            </h1>
            <p>{content.hero.intro}</p>
            <div className="hero-actions">
              <a href="#contact" className="btn btn-primary">{content.hero.primaryCta}</a>
              <a href="#services" className="btn btn-outline">{content.hero.secondaryCta}</a>
            </div>
            <div className="hero-stats">
              {(content.stats ?? []).map((item) => (
                <div className="stat" key={`${item.value}-${item.label}`}>
                  <div className="stat-number">{item.value}</div>
                  <div className="stat-label">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image">
              {content.hero.videoUrl ? (
                <video autoPlay loop muted playsInline poster={content.hero.posterUrl}>
                  <source src={content.hero.videoUrl} type="video/mp4" />
                </video>
              ) : (
                <img src={content.hero.posterUrl} alt="Geomate Links field operations" />
              )}
              <div className="hero-image-overlay">
                <span>{content.hero.videoCaption}</span>
                <span>{content.hero.videoCoords}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section about" id="about">
        <div className="section-inner">
          <div className="about-grid">
            <div className="about-text">
              <span className="section-label">{content.pages.about.label}</span>
              <h2 className="section-title">{content.pages.about.title}</h2>
              <p>{content.pages.about.body}</p>
              <p>{content.company.corporateInfo}</p>
              <p>{content.company.humanResources}</p>
              <p>
                <strong>CAC registration:</strong> {content.company.rcNumber} · <strong>Incorporated:</strong>{" "}
                {content.company.established}
              </p>
            </div>
            <div className="about-image-grid">
              {aboutImages.map((src, index) => (
                <img key={src} src={src} alt={`Geomate Links field record ${index + 1}`} loading="lazy" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="services">
        <div className="section-inner">
          <span className="section-label">{content.pages.services.label}</span>
          <h2 className="section-title">{content.pages.services.title}</h2>
          <div className="services-list">
            {(content.services ?? []).map((service) => (
              <div className="service-row" key={service.id}>
                <span className="service-num">{service.num}</span>
                <h3>{service.title}</h3>
                <p>{service.blurb}</p>
                <span className="service-arrow">→</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section projects" id="projects">
        <div className="section-inner">
          <div className="projects-header">
            <div>
              <span className="section-label">{content.pages.projects.label}</span>
              <h2 className="section-title">{content.pages.projects.title}</h2>
            </div>
            <div className="projects-nav">
              <button
                type="button"
                className="projects-nav-btn"
                onClick={() => goToSlide(currentSlide - 1)}
                disabled={currentSlide === 0}
                aria-label="Previous projects"
              >
                ←
              </button>
              <div className="projects-dots">
                {Array.from({ length: totalSlides }).map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`projects-dot ${index === currentSlide ? "active" : ""}`}
                    onClick={() => goToSlide(index)}
                    aria-label={`Projects page ${index + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                className="projects-nav-btn"
                onClick={() => goToSlide(currentSlide + 1)}
                disabled={currentSlide === totalSlides - 1}
                aria-label="Next projects"
              >
                →
              </button>
            </div>
          </div>

          <div className="projects-grid">
            {visibleProjects.map((project) => (
              <article className="project-item" key={project.id}>
                <img src={project.thumb || project.image} alt={project.alt} loading="lazy" />
                <div className="project-overlay">
                  <span className="project-category">{project.category}</span>
                  <span className="project-title">{project.title}</span>
                  <span className="project-meta">
                    {project.location} · {project.status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="contact">
        <div className="section-inner">
          <div className="contact-grid">
            <div className="contact-details">
              <span className="section-label">{content.pages.contact.label}</span>
              <h2 className="section-title">{content.pages.contact.title}</h2>
              <h3>{content.pages.contact.body}</h3>
              <div className="contact-row">
                <span className="label">Address</span>
                <span className="value">
                  {content.company.address.suite}, {content.company.address.street}, {content.company.address.city},{" "}
                  {content.company.address.state}
                </span>
              </div>
              <div className="contact-row">
                <span className="label">Phone</span>
                <span className="value">
                  {(content.company.phones ?? []).map((phone, index) => (
                    <span key={phone}>
                      {index > 0 ? " · " : ""}
                      <a href={`tel:${phone.replace(/\s+/g, "")}`}>{phone}</a>
                    </span>
                  ))}
                </span>
              </div>
              <div className="contact-row">
                <span className="label">Email</span>
                <span className="value">
                  <a href={`mailto:${content.company.emails?.[0]}`}>{content.company.emails?.[0]}</a>
                </span>
              </div>
              <div className="contact-row">
                <span className="label">Hours</span>
                <span className="value">{content.company.hours}</span>
              </div>

              <form className="contact-form" onSubmit={handleSubmit}>
                <div className="contact-form-row">
                  <input name="name" value={form.name} onChange={updateField} placeholder="Full name" required />
                  <input name="email" type="email" value={form.email} onChange={updateField} placeholder="Email" required />
                </div>
                <div className="contact-form-row">
                  <input name="phone" value={form.phone} onChange={updateField} placeholder="Phone" />
                  <input name="subject" value={form.subject} onChange={updateField} placeholder="Subject" />
                </div>
                <textarea name="message" value={form.message} onChange={updateField} placeholder="Project details" rows={4} required />
                <button type="submit" className="btn btn-primary" disabled={status === "sending"}>
                  {status === "sending" ? "Sending…" : "Send Enquiry"}
                </button>
                {statusMessage && (
                  <p className={status === "error" ? "form-error" : "form-success"}>{statusMessage}</p>
                )}
              </form>
            </div>
            <div className="contact-map">
              <iframe
                src={content.company.mapEmbed}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Geomate Links office location on Google Maps"
              />
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            Geomate Links <span>Consulting Ltd</span> — Est. 2007
          </div>
          <div className="footer-links">
            {FOOTER_LINKS.map((item) => (
              <a key={item.label} href={item.href}>
                {item.label}
              </a>
            ))}
            <Link to="/admin">Admin</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Geomate Links Consulting Limited. All rights reserved.</span>
          <span>Registered with SURCON · {content.company.rcNumber}</span>
        </div>
      </footer>
    </div>
  )
}
