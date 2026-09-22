import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// DEV MODE: password protection is intentionally disabled while the site is
// under construction — the dashboard opens directly. Before going to
// production, restore the session check and the login form (AdminLogin)
// so /api/admin/session gates access again.
export const useAdminAuth = () => {
  const [loading, setLoading] = useState(false)
  const [authenticated, setAuthenticated] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    // Session check disabled while password protection is off.
    setLoading(false)
  }, [])

  const login = async (_password?: string): Promise<boolean> => {
    setAuthenticated(true)
    navigate('/admin', { replace: true })
    return true
  }

  const logout = async () => {
    setAuthenticated(false)
    navigate('/admin/login', { replace: true })
  }

  return { loading, authenticated, login, logout }
}
