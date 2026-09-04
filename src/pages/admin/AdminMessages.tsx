import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { fetchMessages, markMessageRead, deleteMessage } from "@/lib/api"
import type { StoredMessage } from "@/types/content"
import { Inbox, Trash2, MailOpen } from "lucide-react"

export default function AdminMessages() {
  const [messages, setMessages] = useState<StoredMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchMessages()
      .then((res) => setMessages(res.messages))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load messages"))
      .finally(() => setLoading(false))
  }, [])

  const markRead = async (id: string) => {
    try {
      const res = await markMessageRead(id)
      setMessages(res.messages)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update message")
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm("Delete this message?")) return
    try {
      const res = await deleteMessage(id)
      setMessages(res.messages)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete message")
    }
  }

  const unread = messages.filter((message) => !message.read).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${messages.length} message(s), ${unread} unread.`}
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && messages.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No enquiries yet. Submissions from the contact form appear here.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {messages.map((message) => (
          <Card key={message.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="truncate">{message.subject}</span>
                  {!message.read && <Badge>New</Badge>}
                </CardTitle>
                <CardDescription className="break-words">
                  {message.name} · <a className="underline" href={`mailto:${message.email}`}>{message.email}</a>
                  {message.phone ? ` · ${message.phone}` : ""}
                </CardDescription>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">{new Date(message.createdAt).toLocaleString()}</Badge>
                {!message.read && (
                  <Button variant="ghost" size="icon" onClick={() => markRead(message.id)} aria-label="Mark as read">
                    <MailOpen className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => remove(message.id)} aria-label="Delete message">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{message.message}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
