import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState, useEffect } from "react"

interface Message {
  id?: string
  name?: string
  email?: string
  message?: string
  read?: boolean
  timestamp?: string
}

export default function AdminMessages() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/messages')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMessages(data)
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
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="text-sm text-muted-foreground">View and manage contact form submissions.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox ({messages.length} messages)</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No messages yet</div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{msg.name}</span>
                      {!msg.read && <span className="text-xs bg-secondary px-2 py-0.5 rounded">New</span>}
                    </div>
                    <p className="text-sm text-muted-foreground">{msg.email}</p>
                    <p className="text-sm mt-2">{msg.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}