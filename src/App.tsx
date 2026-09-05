import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

const HomePage = lazy(() => import("@/pages/HomePage"))
const LoginPage = lazy(() => import("@/pages/LoginPage"))
const AdminLoginPage = lazy(() => import("@/pages/admin/AdminLoginPage"))
const AdminProvider = lazy(() => import("@/hooks/useAdminAuth"))
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"))
const AdminOverview = lazy(() => import("@/pages/admin/AdminOverview"))
const AdminHome = lazy(() => import("@/pages/admin/AdminHome"))
const AdminServices = lazy(() => import("@/pages/admin/AdminServices"))
const AdminProjects = lazy(() => import("@/pages/admin/AdminProjects"))
const AdminMessages = lazy(() => import("@/pages/admin/AdminMessages"))
const AdminMedia = lazy(() => import("@/pages/admin/AdminMedia"))
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"))
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
          <Route path="/admin" element={<AdminProvider>}>
            <AdminLayout>
              <Routes>
                <Route index element={<AdminOverview />} />
                <Route path="home" element={<AdminHome />} />
                <Route path="services" element={<AdminServices />} />
                <Route path="projects" element={<AdminProjects />} />
                <Route path="media" element={<AdminMedia />} />
                <Route path="messages" element={<AdminMessages />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="settings/profile" element={<AdminProfilePage />} />
              </Routes>
            </AdminLayout>
          </AdminProvider>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}