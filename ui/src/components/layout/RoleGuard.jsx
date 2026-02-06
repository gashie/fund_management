import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export default function RoleGuard({ allowedRoles }) {
  const { user, isAuthenticated, getDefaultRoute } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Admin has access to everything
  if (user?.role === 'admin') {
    return <Outlet />
  }

  // Check if user has required role
  if (!allowedRoles.includes(user?.role)) {
    // Redirect to user's default route
    return <Navigate to={getDefaultRoute()} replace />
  }

  return <Outlet />
}
