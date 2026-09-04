import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { SiteContent } from "@/types/content"
import { fetchContent, saveContent as persistContent, checkSession, logout as endSession } from "@/lib/api"

type AdminStore = {
  content: SiteContent | null
  loading: boolean
  authenticated: boolean
  dirty: boolean
  saving: boolean
  error: string
  notice: string
  update: (updater: (draft: SiteContent) => SiteContent) => void
  save: () => Promise<void>
  reload: () => Promise<void>
  signOut: () => Promise<void>
  setNotice: (value: string) => void
}

const AdminContext = createContext<AdminStore | undefined>(undefined)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SiteContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const bootstrap = useCallback(async () => {
    setLoading(true)
    try {
      const session = await checkSession()
      setAuthenticated(session.authenticated)
      const data = await fetchContent()
      setContent(data)
      setDirty(false)
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  const update = useCallback((updater: (draft: SiteContent) => SiteContent) => {
    setContent((prev) => {
      if (!prev) return prev
      const next = updater(structuredClone(prev))
      return next
    })
    setDirty(true)
    setNotice("")
  }, [])

  const save = useCallback(async () => {
    if (!content) return
    setSaving(true)
    setError("")
    try {
      await persistContent(content)
      setDirty(false)
      setNotice("Changes published to the live site.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes")
    } finally {
      setSaving(false)
    }
  }, [content])

  const signOut = useCallback(async () => {
    try {
      await endSession()
    } finally {
      setAuthenticated(false)
    }
  }, [])

  const value = useMemo<AdminStore>(
    () => ({
      content,
      loading,
      authenticated,
      dirty,
      saving,
      error,
      notice,
      update,
      save,
      reload: bootstrap,
      signOut,
      setNotice,
    }),
    [content, loading, authenticated, dirty, saving, error, notice, update, save, bootstrap, signOut]
  )

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider")
  return ctx
}
