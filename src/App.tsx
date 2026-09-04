import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"

const HomePage = lazy(() => import("@/pages/HomePage"))
const LoginPage = lazy(() => import("@/pages/LoginPage"))
const AdminLoginPage = lazy(() => import("@/pages/admin/AdminLoginPage"))
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"))
const AdminDashboardPage = lazy(() => import("@/pages/admin/AdminDashboardPage"))
const AdminPagesPage = lazy(() => import("@/pages/admin/PagesPage"))
const AdminServicesPage = lazy(() => import("@/pages/admin/ServicesPage"))
const AdminProjectsPage = lazy(() => import("@/pages/admin/ProjectsPage"))
const AdminMessagesPage = lazy(() => import("@/pages/admin/MessagesPage"))
const AdminMediaPage = lazy(() => import("@/pages/admin/MediaPage"))
const AdminSettingsPage = lazy(() => import("@/pages/admin/SettingsPage"))
const AdminProfilePage = lazy(() => import("@/pages/admin/ProfilePage"))
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
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="pages" element={<AdminPagesPage />} />
            <Route path="services" element={<AdminServicesPage />} />
            <Route path="projects" element={<AdminProjectsPage />} />
            <Route path="messages" element={<AdminMessagesPage />} />
            <Route path="media" element={<AdminMediaPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="settings/profile" element={<AdminProfilePage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
