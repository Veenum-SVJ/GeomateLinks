import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { fetchMessages } from "@/lib/api"
import type { StoredMessage } from "@/types/content"

type UnreadContextValue = {
  unread: number
  /** Re-fetch the inbox from the API and update the count (used by polling). */
  refresh: () => void
  /** Update the count from a list the caller already has (e.g. a PATCH response). */
  syncFromMessages: (messages: StoredMessage[]) => void
}

const UnreadContext = createContext<UnreadContextValue>({
  unread: 0,
  refresh: () => {},
  syncFromMessages: () => {},
})

function countUnread(messages: StoredMessage[]) {
  return messages.filter((m) => !m.read).length
}

/**
 * Tracks how many contact-form messages are unread, so the sidebar can show
 * a live badge. Polls periodically to catch new submissions; admin mutations
 * call syncFromMessages with the authoritative response to update instantly.
 */
export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0)
  const mounted = useRef(true)

  const syncFromMessages = useCallback((messages: StoredMessage[]) => {
    if (mounted.current) setUnread(countUnread(messages ?? []))
  }, [])

  const refresh = useCallback(() => {
    fetchMessages()
      .then((data) => syncFromMessages(data.messages ?? []))
      .catch(() => {
        /* transient network/API errors leave the current badge as-is */
      })
  }, [syncFromMessages])

  useEffect(() => {
    mounted.current = true
    refresh()
    const interval = window.setInterval(refresh, 20000)
    return () => {
      mounted.current = false
      window.clearInterval(interval)
    }
  }, [refresh])

  return (
    <UnreadContext.Provider value={{ unread, refresh, syncFromMessages }}>
      {children}
    </UnreadContext.Provider>
  )
}

export function useUnreadMessages() {
  return useContext(UnreadContext)
}
