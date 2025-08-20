import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal, Scaling, Map, Globe2, Archive, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const services = [
  { icon: Scaling, title: "Surveying Services", description: "High-precision cadastral, topographic, and engineering surveys..." },
  { icon: Map, title: "Mapping Services", description: "Comprehensive mapping solutions including satellite imagery..." },
  { icon: Globe2, title: "GIS & LIS", description: "Development of robust Geographic and Land Information Systems..." },
  { icon: Archive, title: "Digitization & Archiving", description: "Converting paper maps and records into digital formats..." },
  { icon: Users, title: "Corporate Training", description: "Specialized training programs in GIS, remote sensing..." },
];

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Services Management</h1>
        <p className="text-muted-foreground">
          Add, edit, or remove your company's services here.
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Your Services</CardTitle>
            <CardDescription>A list of all services offered by your company.</CardDescription>
          </div>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Service
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Icon</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                      <service.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{service.title}</TableCell>
                  <TableCell className="text-muted-foreground max-w-sm truncate">{service.description}</TableCell>
                  <TableCell className="text-right">
                     <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                     </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
