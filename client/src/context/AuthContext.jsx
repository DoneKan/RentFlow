import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as authService from '../services/auth.service'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('rentflow_token')
    if (!token) {
      setIsLoading(false)
      return
    }
    authService
      .getMe()
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('rentflow_token')
        localStorage.removeItem('rentflow_user')
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await authService.login(email, password)
    const { token, user: userData } = res.data
    localStorage.setItem('rentflow_token', token)
    localStorage.setItem('rentflow_user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }, [])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } catch (_) {
      // ignore network errors on logout
    }
    localStorage.removeItem('rentflow_token')
    localStorage.removeItem('rentflow_user')
    setUser(null)
    navigate('/login')
  }, [navigate])

  const updateUser = useCallback((data) => {
    setUser((prev) => ({ ...prev, ...data }))
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
