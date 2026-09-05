import { useState } from 'react'
import { useAdminAuth } from '../../contexts/AdminAuthProvider'

export default function AdminLogin({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const { login } = useAdminAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const success = await login(password)
      if (success) {
        onLoginSuccess()
      } else {
        setError('Invalid password')
      }
    } catch {
      setError('Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            placeholder="Enter admin password"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-brown text-white py-2 rounded-md hover:bg-brand-brown/90 disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  )
}