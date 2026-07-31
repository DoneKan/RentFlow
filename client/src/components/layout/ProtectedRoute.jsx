import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../ui/LoadingSpinner'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  if (isLoading) return <LoadingSpinner fullPage />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user?.role)) return <Navigate to="/" replace />
  return children
}
