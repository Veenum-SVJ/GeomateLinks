import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface AdminUser {
  authenticated: boolean
}

interface AdminAuthContextType {
  user: AdminUser | null
  login: (password: string) => Promise<boolean>
  logout: () => void
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)

  useEffect(() => {
    // Check if user is already authenticated
    fetch('/api/admin/session', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setUser(data.authenticated ? { authenticated: true } : null)
      })
      .catch(() => setUser(null))
  }, [])

  const login = async (password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password })
      })
      const data = await res.json()
      if (data.ok) {
        setUser({ authenticated: true })
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
    } catch {}
    setUser(null)
  }

  return (
    <AdminAuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }
  return context
}