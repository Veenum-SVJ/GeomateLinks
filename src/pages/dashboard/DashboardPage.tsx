import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, FileText, FolderKanban, Mails } from "lucide-react"

export default function DashboardPage() {
  const stats = [
    { title: "New Messages", value: "16", icon: Mails, href: "/dashboard/messages" },
    { title: "Total Projects", value: "8", icon: FolderKanban, href: "/dashboard/projects" },
    { title: "Services Offered", value: "5", icon: Briefcase, href: "/dashboard/services" },
    { title: "Content Pages", value: "3", icon: FileText, href: "/dashboard/pages" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">An overview of your website's content and activity.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <Link to={stat.href} className="text-xs text-muted-foreground hover:text-primary">
                View all
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Messages</CardTitle>
            <Link to="/dashboard/messages" className="text-xs underline underline-offset-4 hover:text-primary">View All</Link>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No recent messages to display.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Projects</CardTitle>
            <Link to="/dashboard/projects" className="text-xs underline underline-offset-4 hover:text-primary">View All</Link>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No recent projects to display.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
