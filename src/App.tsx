import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AdminAuthProvider } from "./contexts/AdminAuthProvider"
import { ErrorBoundary } from "./components/ErrorBoundary"

const HomePage = lazy(() => import("@/pages/HomePage"))
const LoginPage = lazy(() => import("./pages/admin/AdminLogin"))
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"))
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"))
const PagesPage = lazy(() => import("./pages/admin/PagesPage"))
const AdminServices = lazy(() => import("./pages/admin/AdminServices"))
const AdminProjects = lazy(() => import("./pages/admin/AdminProjects"))
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages"))
const AdminMedia = lazy(() => import("./pages/admin/AdminMedia"))
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"))
const ProfilePage = lazy(() => import("./pages/admin/ProfilePage"))

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-brand-cream">
    <div className="text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-brown border-t-transparent mx-auto mb-4"></div>
      <p className="font-mono text-sm text-brand-warm-gray uppercase tracking-widest">Loading...</p>
    </div>
  </div>
)

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AdminAuthProvider>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/admin/login" element={<LoginPage onLoginSuccess={() => {}} />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminOverview />} />
                <Route path="pages" element={<PagesPage />} />
                <Route path="services" element={<AdminServices />} />
                <Route path="projects" element={<AdminProjects />} />
                <Route path="messages" element={<AdminMessages />} />
                <Route path="media" element={<AdminMedia />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="settings/profile" element={<ProfilePage />} />
              </Route>
            </Routes>
          </Suspense>
        </AdminAuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default App