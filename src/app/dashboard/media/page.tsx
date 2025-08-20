import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function MediaPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Media Library</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Manage your uploaded media files here.</p>
      </CardContent>
    </Card>
  );
}
