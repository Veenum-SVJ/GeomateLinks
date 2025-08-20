import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";

export default function MessagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contact Messages</h1>
        <p className="text-muted-foreground">
          View messages submitted through the contact form.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Inbox</CardTitle>
          <CardDescription>Here are the latest messages from your website.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12">
            <p className="text-muted-foreground">You have no new messages.</p>
        </CardContent>
      </Card>
    </div>
  );
}
