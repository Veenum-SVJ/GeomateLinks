import Link from "next/link";
import { Facebook, Linkedin, Twitter } from "lucide-react";
import { Logo } from "./logo";
import { Button } from "../ui/button";

export function Footer() {
  const quickLinks = [
    { name: "About Us", href: "#about" },
    { name: "Services", href: "#services" },
    { name: "Projects", href: "#projects" },
    { name: "Contact", href: "#contact" },
  ];

  const socialLinks = [
    { name: "Facebook", icon: Facebook, href: "#" },
    { name: "Twitter", icon: Twitter, href: "#" },
    { name: "LinkedIn", icon: Linkedin, href: "#" },
  ];

  return (
    <footer className="bg-card text-card-foreground border-t">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-4 md:col-span-1">
            <Logo />
            <p className="text-sm text-muted-foreground">
              Leading the way in innovative Surveying, Mapping, and GIS solutions in Nigeria.
            </p>
          </div>

          <div className="md:col-span-3">
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <h3 className="font-semibold text-primary">Quick Links</h3>
                <ul className="mt-4 space-y-2">
                  {quickLinks.map((link) => (
                    <li key={link.name}>
                      <Link href={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-primary">Contact Us</h3>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li>123 Surveyors Avenue, Abuja</li>
                  <li>Nigeria</li>
                  <li className="pt-2">info@geomate-links.com.ng</li>
                  <li>(+234) 803 123 4567</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-primary">Follow Us</h3>
                <div className="mt-4 flex space-x-2">
                  {socialLinks.map((social) => (
                    <Button key={social.name} variant="ghost" size="icon" asChild>
                      <a href={social.href} aria-label={social.name}>
                        <social.icon className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                      </a>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-primary transition-colors">
                &copy;
            </Link>
            {" "}{new Date().getFullYear()} Geomate Links Consulting Limited. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}
