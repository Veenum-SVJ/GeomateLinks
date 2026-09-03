import { BrowserRouter, Routes, Route } from "react-router-dom"
import HomePage from "./pages/HomePage"
import LoginPage from "./pages/LoginPage"
import NotFound from "./pages/NotFound"
import { Header } from "@/components/landing/header"
import { Footer } from "@/components/landing/footer"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import useSEO from "./hooks/useSEO"

function Layout({ children }: { children: React.ReactNode }) {
  useSEO()
  return (
    <>
      <Header />
      <Breadcrumb />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><HomePage /></Layout>} />
        <Route path="/login" element={<Layout><LoginPage /></Layout>} />
        <Route path="*" element={
          <Layout>
            <NotFound />
          </Layout>
        } />
      </Routes>
    </BrowserRouter>
  )
}
