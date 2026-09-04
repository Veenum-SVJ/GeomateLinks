import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Mail, Trash2 } from "lucide-react"

type Message = {
  id: string
  name: string
  email: string
  phone: string
  subject: string
  message: string
  date: string
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMessages()
  }, [])

  const loadMessages = async () => {
    try {
      const res = await fetch("/api/admin/messages")
      const data = await res.json()
      setMessages(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error("Failed to load messages", e)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return
    try {
      const res = await fetch(`/api/admin/messages/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      setMessages((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      alert("Failed to delete message")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-brand-brown" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">Contact form submissions from your website.</p>
      </div>
      <div className="grid gap-4">
        {messages.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Mail className="mx-auto mb-4 h-12 w-12 text-brand-warm-gray" />
              <p className="text-muted-foreground">No messages yet.</p>
            </CardContent>
          </Card>
        ) : (
          messages.map((message) => (
            <Card key={message.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{message.subject || "New message"}</CardTitle>
                    <CardDescription>
                      From {message.name} · {message.email} · {message.phone}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{message.date}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(message.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-brand-warm-gray whitespace-pre-wrap">{message.message}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
