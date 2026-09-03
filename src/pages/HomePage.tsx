import { Link } from "react-router-dom"
import { useState, useEffect } from "react"
import { Header } from "@/components/landing/header"
import { Footer } from "@/components/landing/footer"
import { Breadcrumb } from "@/components/ui/breadcrumb"

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);

  const slides = [
    {
      id: 1,
      category: "Cadastral",
      title: "Ibadan Land Title Survey",
      description: "Complete boundary determination and title registration support for a 50-hectare residential development.",
      image: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1200&q=80"
    },
    {
      id: 2,
      category: "Drone Mapping",
      title: "Topographic Survey — Oyo State",
      description: "Aerial photogrammetry covering 200km² for infrastructure planning and environmental assessment.",
      image: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1200&q=80"
    },
    {
      id: 3,
      category: "GIS",
      title: "Urban Planning Analysis",
      description: "Comprehensive GIS analysis for municipal planning, zoning, and land use optimization.",
      image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&q=80"
    },
    {
      id: 4,
      category: "Surveying",
      title: "Engineering Boundary Survey",
      description: "High-precision engineering survey for commercial complex construction with sub-centimeter accuracy.",
      image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80"
    }
  ];

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (scrolled / maxScroll) * 100;
      setScrollProgress(progress);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const goToSlide = (index: number) => {
    if (index < 0) setCurrentSlide(slides.length - 1);
    else if (index >= slides.length) setCurrentSlide(0);
    else setCurrentSlide(index);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Navigation with Progress Bar */}
      <nav className="relative">
        <div className="nav-progress">
          <div className="nav-progress-fill" style={{ width: `${scrollProgress}%` }}></div>
        </div>
        <div className="nav-inner">
          <Link to="/" className="logo">
            <div className="logo-mark">GL</div>
            GEOMATE LINKS
          </Link>
          <ul className="nav-links">
            <li><Link to="#about">About</Link></li>
            <li><Link to="#services">Services</Link></li>
            <li><Link to="#projects">Projects</Link></li>
            <li><Link to="#contact">Contact</Link></li>
            <li><Link to="#contact" className="nav-cta">Get Quote</Link></li>
          </ul>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-text">
            <div className="hero-tag">Geospatial Solutions — Ibadan, Nigeria</div>
            <h1>We Map the World<br /><span>One Coordinate</span><br />at a Time</h1>
            <p>Precision surveying, drone mapping, and GIS solutions for projects that demand accuracy. Serving Nigeria and beyond since 2007.</p>
            <div className="hero-actions">
              <Link to="#contact" className="btn btn-primary">Start a Project →</Link>
              <Link to="#services" className="btn btn-outline">Our Services</Link>
            </div>
            <div className="hero-stats">
              <div className="stat">
                <div className="stat-number">17+</div>
                <div className="stat-label">Years Experience</div>
              </div>
              <div className="stat">
                <div className="stat-number">500+</div>
                <div className="stat-label">Projects Completed</div>
              </div>
              <div className="stat">
                <div className="stat-number">50+</div>
                <div className="stat-label">Clients Served</div>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image">
              <img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80" alt="Survey field work in Nigerian landscape" />
              <div className="hero-image-overlay">
                <span>IMG_20250502_123423</span>
                <span>7.43°N 3.91°E</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="section" id="about">
        <div className="section-inner">
          <div className="about-grid">
            <div className="about-text">
              <span className="section-label">01 — About</span>
              <h2 className="section-title">Precision Is Not Just<br />What We Do — It's<br />Who We Are</h2>
              <p>Established in <strong>2007</strong>, Geomate Links Consulting Limited has grown from a small surveying practice to one of Nigeria's trusted geospatial firms.</p>
              <p>We specialize in <strong>cadastral surveying, topographic mapping, drone-based aerial surveys, and GIS development</strong>. Our team combines traditional surveying expertise with cutting-edge drone and satellite technology.</p>
              <p>Whether it's a boundary dispute, a large-scale development project, or a government land registry digitization, we deliver results with <strong>sub-centimeter accuracy</strong>.</p>
            </div>
            <div className="about-image-grid">
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80" alt="Team member" />
              <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80" alt="Field equipment" />
              <img src="https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&q=80" alt="Drone survey" />
              <img src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&q=80" alt="GIS work" />
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="section" id="services">
        <div className="section-inner">
          { /* Services Content */}
          <span className="section-label">02 — Services</span>
          <h2 className="section-title">What We Offer</h2>
          <div className="services-list">
            <div className="service-row">
              <span className="service-num">01</span>
              <h3>Cadastral Surveying</h3>
              <p>Boundary determination, land subdivision, and title registration support</p>
            </div>
            <div className="service-row">
              <span className="service-num">02</span>
              <h3>Topographic Mapping</h3>
              <p>Contour mapping, terrain analysis, and engineering survey plots</p>
            </div>
            <div className="service-row">
              <span className="service-num">03</span>
              <h3>Drone Aerial Survey</h3>
              <p>UAV photogrammetry, orthomosaics, and 3D terrain modeling</p>
            </div>
            <div className="service-row">
              <span className="service-num">04</span>
              <h3>GIS & Land Information Systems</h3>
              <p>Custom database development, spatial analysis, and map production</p>
            </div>
            <div className="service-row">
              <span className="service-num">05</span>
              <h3>Digitization & Archiving</h3>
              <p>Paper-to-digital conversion, historical map preservation, data migration</p>
            </div>
            <div className="service-row">
              <span className="service-num">06</span>
              <h3>Training & Capacity Building</h3>
              <p>Corporate GIS training, surveying workshops, and technical courses</p>
            </div>
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section className="section" id="projects">
        <div className="section-inner">
          <div className="projects-header">
            <div>
              <span className="section-label">03 — Projects</span>
              <h2 className="section-title">Recent Work</h2>
            </div>
          </div>
          
          {/* Projects Grid */}
          <div className="projects-grid">
            {slides.slice(currentSlide * 2, (currentSlide + 1) * 2).map((project, index) => (
              <div key={project.id} className="project-item">
                <img src={project.image} alt={project.title} />
                <div className="project-overlay">
                  <span className="project-category">{project.category}</span>
                  <span className="project-title">{project.title}</span>
                </div>
              ))}
          </div>
          
          {/* Navigation Controls */}
          { /* Projects Navigation Controls */}
          <div className="projects-nav">
            <button 
              className="projects-nav-btn" 
              onClick={() => goToSlide(currentSlide - 1)}
              disabled={currentSlide === 0}
              aria-label="Previous projects"
            >
              ←
            </button>
            <div className="projects-dots">
              {slides.map((_, index) => (
                <button 
                  key={index}
                  className={`projects-dot ${index === currentSlide ? 'active' : ''}`}
                  onClick={() => goToSlide(index)}
                  aria-label={`Go to projects page ${index + 1}`}
                />
              ))}
            </div>
            <button 
              className="projects-nav-btn" 
              onClick={() => goToSlide(currentSlide + 1)}
              disabled={currentSlide === slides.length / 2 - 1}
              aria-label="Next projects"
            >
              →
            </button>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="section" id="contact">
        <div className="section-inner">
          { /* Contact Content */}
          <div className="contact-grid">
            <div className="contact-details">
              <span className="section-label">04 — Contact</span>
              <h2 className="section-title">Reach Out</h2>
              <h3>Let's Discuss Your Project</h3>
              { /* Contact Details */}
              <div className="contact-row">
                <span className="label">Address</span>
                <span className="value">Josbeed Mall, Ashi Bodija Rd, Ibadan</span>
              </div>
              { /* Contact Row Content */}
              <div className="contact-row">
                <span className="label">Phone</span>
                <span className="value"><a href="tel:+2348033341424">+234 803 334 1424</a></span>
              </div>
              { /* Contact Row Content */}
              <div className="contact-row">
                <span className="label">Email</span>
                <span className="value"><a href="mailto:geomatelinks@gmail.com">geomatelinks@gmail.com</a></span>
              </div>
              { /* Contact Row Content */}
              <div className="contact-row">
                <span className="label">Hours</span>
                <span className="value">Mon–Fri: 8AM – 5PM WAT</span>
              </div>
            </div>
            { /* Contact Map */}
            <div className="contact-map">
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3952.123!2d3.9304994!3d7.4275!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1039ed0e8bb16fcf%3A0xf4da9748b9909654!2sGeomate%20Links%20Consulting%20Ltd!5e0!3m2!1sen!2sng!4v1234567890"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
                title="Geomate Links office location on Google Maps"
              ></iframe>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}