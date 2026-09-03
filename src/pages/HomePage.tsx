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

  const goToSlide = (index) => {
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
              <Link to="#services">Our Services</Link>
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
          { /* About content */}
        </div>
      </section>
    </div>
  );
}