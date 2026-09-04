import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"

const HomePage = lazy(() => import("@/pages/HomePage"))
const LoginPage = lazy(() => import("@/pages/LoginPage"))
const DashboardLayout = lazy(() => import("@/pages/dashboard/DashboardLayout"))
const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage"))
const PagesPage = lazy(() => import("@/pages/dashboard/PagesPage"))
const ServicesPage = lazy(() => import("@/pages/dashboard/ServicesPage"))
const ProjectsPage = lazy(() => import("@/pages/dashboard/ProjectsPage"))
const MessagesPage = lazy(() => import("@/pages/dashboard/MessagesPage"))
const MediaPage = lazy(() => import("@/pages/dashboard/MediaPage"))
const SettingsPage = lazy(() => import("@/pages/dashboard/SettingsPage"))
const ProfileSettingsPage = lazy(() => import("@/pages/dashboard/settings/ProfileSettingsPage"))
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"))

function RouteSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-cream px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-brand-brown border-t-transparent" />
        <p className="font-mono text-xs uppercase tracking-widest text-brand-warm-gray">Loading</p>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteSkeleton />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="pages" element={<PagesPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="media" element={<MediaPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/profile" element={<ProfileSettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
