"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, X } from "lucide-react";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

const navLinks = [
  { name: "About", href: "#about" },
  { name: "Services", href: "#services" },
  { name: "Projects", href: "#projects" },
  { name: "Contact", href: "#contact" },
];

export function Header() {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [activeLink, setActiveLink] = useState("");

  useEffect(() => {
    const handleScroll = () => {
      const sections = navLinks.map(link => document.querySelector(link.href));
      let currentSection = "";

      sections.forEach(section => {
        if (section) {
          const sectionTop = (section as HTMLElement).offsetTop;
          const sectionHeight = (section as HTMLElement).clientHeight;
          if (window.scrollY >= sectionTop - sectionHeight / 3) {
            currentSection = `#${section.id}`;
          }
        }
      });

      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 2) {
          currentSection = "#contact";
      }

      setActiveLink(currentSection);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); 

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center">
        <div className="flex-1 flex justify-start">
          <Logo />
        </div>
        
        <nav className="hidden flex-1 items-center justify-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors",
                activeLink === link.href ? "text-primary" : "text-muted-foreground hover:text-primary"
              )}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        <div className="flex-1 flex items-center justify-end gap-4">
          <Button asChild className="hidden md:flex bg-primary hover:bg-primary/90">
            <Link href="#contact">Get a Quote</Link>
          </Button>

          <Sheet open={isMenuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[350px]">
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b pb-4">
                  <Logo />
                  <Button variant="ghost" size="icon" onClick={() => setMenuOpen(false)}>
                    <X className="h-6 w-6" />
                    <span className="sr-only">Close menu</span>
                  </Button>
                </div>
                <nav className="mt-8 flex flex-col gap-6">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "text-lg font-medium transition-colors",
                        activeLink === link.href ? "text-primary" : "text-muted-foreground hover:text-primary"
                      )}
                    >
                      {link.name}
                    </Link>
                  ))}
                </nav>
                <Button asChild className="mt-auto bg-accent hover:bg-accent/90">
                  <Link href="#contact" onClick={() => setMenuOpen(false)}>Get a Quote</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
