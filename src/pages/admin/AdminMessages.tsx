import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import { markMessageRead, deleteMessage } from "@/lib/api"
import { useUnreadMessages } from "@/hooks/useUnreadMessages"

export default function AdminMessages() {
  // The inbox is owned by the shared provider (single poll loop feeding the
  // sidebar badge and the dashboard too) — this page only renders it and
  // syncs mutation responses back into it.
  const { messages, loading, syncFromMessages } = useUnreadMessages()
  const [error, setError] = useState("")

  const handleRead = async (id: string) => {
    try {
      const data = await markMessageRead(id)
      syncFromMessages(data.messages ?? [])
    } catch {
      setError("Could not update the message")
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const data = await deleteMessage(id)
      syncFromMessages(data.messages ?? [])
    } catch {
      setError("Could not delete the message")
    }
  }

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
        <p className="text-sm text-muted-foreground">Enquiries submitted through the contact form.</p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Inbox ({messages.length} message{messages.length === 1 ? "" : "s"})</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No messages yet</div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-3 border rounded-lg p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={msg.read ? "font-medium" : "font-semibold"}>
                        {msg.name}
                      </span>
                      {!msg.read && (
                        <span className="rounded bg-brand-brown px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <a href={`mailto:${msg.email}`} className="hover:underline">{msg.email}</a>
                      {msg.phone ? <span> · {msg.phone}</span> : null}
                    </p>
                    {msg.subject ? <p className="text-sm font-medium mt-2">{msg.subject}</p> : null}
                    <p className="text-sm mt-1 whitespace-pre-wrap">{msg.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(msg.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!msg.read && (
                      <button
                        onClick={() => handleRead(msg.id)}
                        className="flex-1 text-xs px-3 py-2 border rounded hover:bg-muted sm:flex-none sm:py-1.5"
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(msg.id)}
                      className="flex-1 text-xs px-3 py-2 border rounded text-red-600 hover:bg-red-50 sm:flex-none sm:py-1.5"
                    >
                      Delete
                    </button>
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
