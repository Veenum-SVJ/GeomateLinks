import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, FileText, ImageIcon, MessageSquare } from "lucide-react";

export default function DashboardPage() {
  const stats = [
    { title: "Page Views", value: "12,345", icon: Eye },
    { title: "Content Pages", value: "5", icon: FileText },
    { title: "Media Files", value: "82", icon: ImageIcon },
    { title: "Contact Queries", value: "16", icon: MessageSquare },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to your CMS</h1>
        <p className="text-muted-foreground">Here's a quick overview of your website's status.</p>
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
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No recent activity to display.</p>
            {/* Placeholder for recent activity feed */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
             <p className="text-muted-foreground">No quick actions available yet.</p>
            {/* Placeholder for quick action buttons */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
