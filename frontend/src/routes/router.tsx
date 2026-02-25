import { createBrowserRouter, redirect } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import RootLayout from '../layouts/RootLayout'
import AdminLayout from '../layouts/AdminLayout'
import { ProtectedRoute } from '../components/ProtectedRoute'
import { GuestRoute } from '../components/GuestRoute'

// Lazy load components
const Home = lazy(() => import('../pages/Home'))
const Dashboard = lazy(() => import('../pages/Dashboard'))
const Login = lazy(() => import('../pages/Login'))
const Register = lazy(() => import('../pages/Register'))
const UsersPage = lazy(() => import('../features/admin/users/UsersPage'))
const ProfilePage = lazy(() => import('../features/profile/ProfilePage'))
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'))
const QuestionBankPage = lazy(() => import('../features/questionbank/QuestionBankPage'))

// Error boundary component
function ErrorBoundary() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-red-600 mb-4">Oops!</h1>
      <p className="text-lg">Something went wrong. Please try again.</p>
    </div>
  )
}

// Loading component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  )
}

const withSuspense = (element: React.ReactNode) => (
  <Suspense fallback={<PageLoader />}>{element}</Suspense>
)

const withGuestOnly = (element: React.ReactNode) => (
  <GuestRoute>{withSuspense(element)}</GuestRoute>
)

export const router = createBrowserRouter([
  // Public + guest routes (RootLayout with top navbar)
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: withSuspense(<Home />),
      },
      {
        path: 'login',
        element: withGuestOnly(<Login />),
      },
      {
        path: 'register',
        element: withGuestOnly(<Register />),
      },
      {
        path: 'forgot-password',
        element: withGuestOnly(<ForgotPasswordPage />),
      },
      {
        path: 'reset-password',
        element: withGuestOnly(<ResetPasswordPage />),
      },
    ],
  },
  // Protected routes (AdminLayout with left sidebar)
  {
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorBoundary />,
    children: [
      {
        path: 'dashboard',
        element: withSuspense(<Dashboard />),
      },
      {
        path: 'admin/users',
        element: withSuspense(<UsersPage />),
      },
      {
        path: 'profile',
        element: withSuspense(<ProfilePage />),
      },
      {
        path: 'question-bank',
        element: withSuspense(<QuestionBankPage />),
      },
    ],
  },
  // Catch-all route
  {
    path: '*',
    loader: () => redirect('/'),
  },
])
