import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { fetchMessages } from "@/lib/api"
import type { StoredMessage } from "@/types/content"

const POLL_MS = 20000

type InboxContextValue = {
  messages: StoredMessage[]
  unread: number
  newest: StoredMessage | null
  /** True until the first fetch settles. */
  loading: boolean
  /** Re-fetch the inbox from the API (polling loop and manual refresh). */
  refresh: () => void
  /** Adopt a list the caller already has (e.g. a PATCH/DELETE response body). */
  syncFromMessages: (messages: StoredMessage[]) => void
}

const InboxContext = createContext<InboxContextValue>({
  messages: [],
  unread: 0,
  newest: null,
  loading: true,
  refresh: () => {},
  syncFromMessages: () => {},
})

function countUnread(messages: StoredMessage[]) {
  return messages.filter((m) => !m.read).length
}

/**
 * Single owner of the contact inbox for the whole admin area. One polling
 * loop feeds every consumer — the sidebar unread badge, the dashboard
 * newest-enquiry card and stats, and the Messages page list — so there are
 * no duplicate fetches and all views stay in lockstep. Admin mutations call
 * syncFromMessages with the authoritative response to update instantly,
 * bypassing Blob storage's read-after-write lag.
 */
export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<StoredMessage[]>([])
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  const syncFromMessages = useCallback((next: StoredMessage[]) => {
    if (mounted.current) setMessages(next ?? [])
  }, [])

  const refresh = useCallback(() => {
    fetchMessages()
      .then((data) => {
        if (!mounted.current) return
        setMessages(data.messages ?? [])
        setLoading(false)
      })
      .catch(() => {
        /* transient network/API errors leave the current list as-is */
        if (mounted.current) setLoading(false)
      })
  }, [])

  useEffect(() => {
    mounted.current = true
    refresh()
    const interval = window.setInterval(refresh, POLL_MS)
    // Poll immediately when the tab becomes visible again instead of waiting
    // out the remainder of the interval.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      mounted.current = false
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [refresh])

  const value = useMemo<InboxContextValue>(() => {
    const sorted = [...messages].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    return {
      messages: sorted,
      unread: countUnread(messages),
      newest: sorted[0] ?? null,
      loading,
      refresh,
      syncFromMessages,
    }
  }, [messages, loading, refresh, syncFromMessages])

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
}

export function useUnreadMessages() {
  return useContext(InboxContext)
}
