import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { PageLoader } from './ui/PageLoader'

interface GuestRouteProps {
  children: React.ReactNode
}

/**
 * GuestRoute component prevents authenticated users from accessing
 * public-only pages like login and register. If the user is already
 * logged in, they will be redirected to the dashboard.
 */
export function GuestRoute({ children }: GuestRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <PageLoader />
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
