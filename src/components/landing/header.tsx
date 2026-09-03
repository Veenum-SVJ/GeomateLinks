import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Menu, X } from "lucide-react"
import { Logo } from "./logo"
import { useState, useEffect } from "react"

const navLinks = [
  { name: "Home", href: "/" },
  { name: "About", href: "#about" },
  { name: "Services", href: "#services" },
  { name: "Projects", href: "#projects" },
  { name: "Contact", href: "#contact" },
]

export function Header() {
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header className={cn(
      "relative",
      scrolled && "shadow-md"
    )}>
      <div className="nav-inner">
        <div className="nav-progress">
          <div className="nav-progress-fill" style={{ width: `${scrollProgress}%` }}></div>
        </div>
        <div className="container mx-auto flex h-16 items-center">
          <div className="flex-1 flex justify-start">
            <Logo />
          </div>
          
          <nav className="hidden flex-1 items-center justify-center gap-6 md:flex" aria-label="Main navigation">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className="text-sm font-medium transition-colors hover:text-primary text-muted-foreground"
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="flex-1 flex items-center justify-end gap-4">
            <Link
              to="/login"
              className="hidden md:inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Admin Login
            </Link>

            <div className="md:hidden">
              <button
                onClick={() => setMenuOpen(!isMenuOpen)}
                className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                aria-expanded={isMenuOpen}
                aria-controls="mobile-menu"
                aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div id="mobile-menu" className="md:hidden border-t bg-background">
          <div className="container py-4 flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-lg font-medium transition-colors hover:text-primary text-muted-foreground"
              >
                {link.name}
              </Link>
            ))}
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Admin Login
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}