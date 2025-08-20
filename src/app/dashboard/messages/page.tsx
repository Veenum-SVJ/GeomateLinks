import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function MessagesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Messages</CardTitle>
      </CardHeader>
      <CardContent>
        <p>View messages submitted through the contact form.</p>
      </CardContent>
    </Card>
  );
}
