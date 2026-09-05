import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useState, useEffect } from "react"

interface Service {
  title?: string
  subtitle?: string
  description?: string
}

export default function AdminServices() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/content')
      .then(res => res.json())
      .then(data => {
        if (data.company?.services) {
          setServices(data.company.services)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-brown border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Services Management</h1>
        <p className="text-sm text-muted-foreground">Manage your company's services.</p>
      </div>

      <div className="grid gap-4">
        {services.map((service, index) => (
          <Card key={index} className="bg-white">
            <CardHeader>
              <CardTitle>{service.title}</CardTitle>
              <CardDescription>{service.subtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{service.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}