import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { Menu, X } from "lucide-react"
import { useLocation } from "react-router-dom"
import { Logo } from "./logo"
import { cn } from "@/lib/utils"

const navLinks = [
  { name: "About", href: "#about" },
  { name: "Services", href: "#services" },
  { name: "Projects", href: "#projects" },
  { name: "Contact", href: "#contact" },
]

export function Header() {
  const [isMenuOpen, setMenuOpen] = useState(false)
  const [activeLink, setActiveLink] = useState("")
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => {
      const sections = navLinks.map(link => document.querySelector(link.href))
      let currentSection = ""

      sections.forEach(section => {
        if (section) {
          const sectionTop = (section as HTMLElement).offsetTop
          const sectionHeight = (section as HTMLElement).clientHeight
          if (window.scrollY >= sectionTop - sectionHeight / 3) {
            currentSection = `#${section.id}`
          }
        }
      })

      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 2) {
        currentSection = "#contact"
      }

      setActiveLink(currentSection)
    }

    window.addEventListener("scroll", handleScroll)
    handleScroll()

    return () => window.removeEventListener("scroll", handleScroll)
  }, [location])

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center">
        <div className="flex-1 flex justify-start">
          <Logo />
        </div>
        
        <nav className="hidden flex-1 items-center justify-center gap-6 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors",
                activeLink === link.href ? "text-primary" : "text-muted-foreground hover:text-primary"
              )}
            >
              {link.name}
            </a>
          ))}
        </nav>

        <div className="flex-1 flex items-center justify-end gap-4">
          <Button asChild className="hidden md:flex bg-primary hover:bg-primary/90">
            <a href="#contact">Get a Quote</a>
          </Button>

          <div className="md:hidden">
            <button
              onClick={() => setMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              <span className="sr-only">Open menu</span>
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden border-t bg-background">
          <div className="container py-4 flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "text-lg font-medium transition-colors",
                  activeLink === link.href ? "text-primary" : "text-muted-foreground hover:text-primary"
                )}
              >
                {link.name}
              </a>
            ))}
            <Button asChild className="bg-accent hover:bg-accent/90 w-full">
              <a href="#contact" onClick={() => setMenuOpen(false)}>Get a Quote</a>
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}
