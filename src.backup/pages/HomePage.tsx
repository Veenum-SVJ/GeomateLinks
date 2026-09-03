import { Header } from "@/components/landing/header"
import { Hero } from "@/components/landing/hero"
import { About } from "@/components/landing/about"
import { Services } from "@/components/landing/services"
import { Projects } from "@/components/landing/projects"
import { Contact } from "@/components/landing/contact"
import { Footer } from "@/components/landing/footer"
import { Breadcrumb } from "@/components/ui/breadcrumb"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <Breadcrumb />
      <main className="flex-1">
        <Hero />
        <About />
        <Services />
        <Projects />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}
