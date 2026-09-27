import { lazy, Suspense } from "react"
import { Routes, Route } from "react-router-dom"
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
const CrmDashboard = lazy(() => import("./pages/admin/crm/CrmDashboard"))
const CrmLeads = lazy(() => import("./pages/admin/crm/LeadsPage"))
const CrmLeadDetail = lazy(() => import("./pages/admin/crm/LeadDetail"))
const CrmClients = lazy(() => import("./pages/admin/crm/ClientsPage"))
const CrmClientDetail = lazy(() => import("./pages/admin/crm/ClientDetail"))
const CrmFollowups = lazy(() => import("./pages/admin/crm/FollowupsPage"))
const CrmActivities = lazy(() => import("./pages/admin/crm/ActivitiesPage"))
const QuotationsOverview = lazy(() => import("./pages/admin/quotations/QuotationsOverview"))
const QuotationsList = lazy(() => import("./pages/admin/quotations/QuotationsList"))
const QuotationEditor = lazy(() => import("./pages/admin/quotations/QuotationEditor"))
const QuotationDetail = lazy(() => import("./pages/admin/quotations/QuotationDetail"))
const QuotationPrint = lazy(() => import("./pages/admin/quotations/QuotationPrint"))
const ProjectsOverview = lazy(() => import("./pages/admin/projects/ProjectsOverview"))
const ProjectsList = lazy(() => import("./pages/admin/projects/ProjectsList"))
const ProjectEditor = lazy(() => import("./pages/admin/projects/ProjectEditor"))
const ProjectDetail = lazy(() => import("./pages/admin/projects/ProjectDetail"))
const StaffDirectory = lazy(() => import("./pages/admin/projects/StaffDirectory"))
const DocumentsOverview = lazy(() => import("./pages/admin/documents/DocumentsOverview"))
const DocumentsList = lazy(() => import("./pages/admin/documents/DocumentsList"))
const DocumentDetail = lazy(() => import("./pages/admin/documents/DocumentDetail"))
const ProjectDocumentsPage = lazy(() => import("./pages/admin/documents/ProjectDocumentsPage"))
const DocumentsProjects = lazy(() => import("./pages/admin/documents/DocumentsProjects"))
const DocumentCategoriesSettings = lazy(() => import("./pages/admin/documents/DocumentCategoriesSettings"))

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
    <ErrorBoundary>
      <AdminAuthProvider>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/admin/login" element={<LoginPage />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverview />} />
              <Route path="pages" element={<PagesPage />} />
              <Route path="services" element={<AdminServices />} />
              <Route path="projects" element={<AdminProjects />} />
              <Route path="messages" element={<AdminMessages />} />
              <Route path="media" element={<AdminMedia />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="settings/profile" element={<ProfilePage />} />
              <Route path="crm" element={<CrmDashboard />} />
              <Route path="crm/leads" element={<CrmLeads />} />
              <Route path="crm/leads/:id" element={<CrmLeadDetail />} />
              <Route path="crm/clients" element={<CrmClients />} />
              <Route path="crm/clients/:id" element={<CrmClientDetail />} />
              <Route path="crm/followups" element={<CrmFollowups />} />
              <Route path="crm/activities" element={<CrmActivities />} />
              <Route path="quotations" element={<QuotationsOverview />} />
              <Route path="quotations/all" element={<QuotationsList />} />
              <Route path="quotations/list/:status" element={<QuotationsList />} />
              <Route path="quotations/new" element={<QuotationEditor />} />
              <Route path="quotations/:id/edit" element={<QuotationEditor />} />
              <Route path="quotations/:id/print" element={<QuotationPrint />} />
              <Route path="quotations/:id" element={<QuotationDetail />} />
              <Route path="pms" element={<ProjectsOverview />} />
              <Route path="pms/all" element={<ProjectsList />} />
              <Route path="pms/list/:status" element={<ProjectsList />} />
              <Route path="pms/new" element={<ProjectEditor />} />
              <Route path="pms/staff" element={<StaffDirectory />} />
              <Route path="pms/:id/edit" element={<ProjectEditor />} />
              <Route path="pms/:id" element={<ProjectDetail />} />
              <Route path="documents" element={<DocumentsOverview />} />
              <Route path="documents/all" element={<DocumentsList variant="all" />} />
              <Route path="documents/recent" element={<DocumentsList variant="recent" />} />
              <Route path="documents/starred" element={<DocumentsList variant="starred" />} />
              <Route path="documents/archived" element={<DocumentsList variant="archived" />} />
              <Route path="documents/projects" element={<DocumentsProjects />} />
              <Route path="documents/categories" element={<DocumentCategoriesSettings />} />
              <Route path="documents/settings" element={<DocumentCategoriesSettings />} />
              <Route path="documents/:id" element={<DocumentDetail />} />
              <Route path="documents/project/:id" element={<ProjectDocumentsPage />} />
            </Route>
          </Routes>
        </Suspense>
      </AdminAuthProvider>
    </ErrorBoundary>
  )
}

export default App
