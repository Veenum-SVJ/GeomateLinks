import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export const useAdminAuth = () => {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/admin/session', { credentials: 'include' })
        const data = await res.json()
        setAuthenticated(data.authenticated || false)
      } catch (err) {
        setAuthenticated(false)
      } finally {
        setLoading(false)
      }
    }

    checkSession()
  }, [])

  const login = async (password: string) => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password })
      })
      if (res.ok) {
        setAuthenticated(true)
        navigate('/admin', { replace: true })
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Login failed')
      }
    } catch (err) {
      throw err
    }
  }

  const logout = async () => {
    await fetch('/api/admin/session', { method: 'DELETE', credentials: 'include' })
    setAuthenticated(false)
    navigate('/admin/login', { replace: true })
  }

  return { loading, authenticated, login, logout }
}