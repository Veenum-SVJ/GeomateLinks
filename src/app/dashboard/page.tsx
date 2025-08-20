import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, FileText, FolderKanban, Mails } from "lucide-react";

export default function DashboardPage() {
  const stats = [
    { title: "New Messages", value: "16", icon: Mails },
    { title: "Total Projects", value: "8", icon: FolderKanban },
    { title: "Services Offered", value: "5", icon: Briefcase },
    { title: "Content Pages", value: "3", icon: FileText },
  ];

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
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Messages</CardTitle>
            <Button variant="outline" size="sm">View All</Button>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No recent messages to display.</p>
            {/* Placeholder for recent messages list */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Projects</CardTitle>
             <Button variant="outline" size="sm">View All</Button>
          </CardHeader>
          <CardContent>
             <p className="text-muted-foreground">No recent projects to display.</p>
            {/* Placeholder for recent projects list */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
