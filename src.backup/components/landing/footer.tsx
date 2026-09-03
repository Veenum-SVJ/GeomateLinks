import { Link } from "react-router-dom"
import { Facebook, Linkedin, Twitter, MapPin, Phone, Mail } from "lucide-react"
import { Logo } from "./logo"
import { Button } from "../ui/button"

export function Footer() {
  const quickLinks = [
    { name: "Home", href: "/", external: false },
    { name: "About Us", href: "#about", external: false },
    { name: "Services", href: "#services", external: false },
    { name: "Projects", href: "#projects", external: false },
    { name: "Contact", href: "#contact", external: false },
    { name: "Admin Login", href: "/login", external: false },
  ]

  const socialLinks = [
    { name: "Facebook", icon: Facebook, href: "https://facebook.com/geomatelinks" },
    { name: "Twitter", icon: Twitter, href: "https://twitter.com/geomatelinks" },
    { name: "LinkedIn", icon: Linkedin, href: "https://linkedin.com/company/geomatelinks" },
  ]

  return (
    <footer className="bg-card text-card-foreground border-t" role="contentinfo">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Company Info */}
          <div className="space-y-4">
            <Logo />
            <p className="text-sm text-muted-foreground">
              Leading the way in innovative Surveying, Mapping, and GIS solutions in Nigeria since 2007.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Josbeed Mall, Ashi Bodija Road, Ibadan</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <a href="tel:+2348033341424" className="hover:text-primary">+234 803 334 1424</a>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <a href="mailto:geomatelinks@gmail.com" className="hover:text-primary">geomatelinks@gmail.com</a>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-primary mb-4">Quick Links</h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  {link.external ? (
                    <a 
                      href={link.href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.name}
                    </a>
                  ) : (
                    <Link 
                      to={link.href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.name}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-semibold text-primary mb-4">Our Services</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Cadastral Surveying</li>
              <li>Topographic Mapping</li>
              <li>GIS & LIS Solutions</li>
              <li>Drone Mapping</li>
              <li>Digitization Services</li>
              <li>Corporate Training</li>
            </ul>
          </div>

          {/* Social & Certifications */}
          <div>
            <h3 className="font-semibold text-primary mb-4">Connect With Us</h3>
            <div className="flex gap-2 mb-4">
              {socialLinks.map((social) => (
                <Button key={social.name} variant="outline" size="icon" asChild>
                  <a href={social.href} target="_blank" rel="noopener noreferrer" aria-label={`Follow us on ${social.name}`}>
                    <social.icon className="h-4 w-4" />
                  </a>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Registered with the Surveyors Council of Nigeria (SRN)
            </p>
          </div>
        </div>
        
        {/* Bottom bar */}
        <div className="mt-8 border-t pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Geomate Links Consulting Limited. All Rights Reserved.</p>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/" className="hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
