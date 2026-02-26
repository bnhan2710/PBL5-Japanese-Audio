import { createBrowserRouter, redirect } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import RootLayout from '../layouts/RootLayout'
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
const CreateExamPage = lazy(() => import('../features/exam/CreateExamPage'))
const ExamListPage = lazy(() => import('../features/exam/ExamListPage'))

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

const routes = {
  public: [
    {
      index: true,
      element: <Home />,
    },
  ],
  guestOnly: [
    {
      path: 'login',
      element: <Login />,
    },
    {
      path: 'register',
      element: <Register />,
    },
    {
      path: 'forgot-password',
      element: <ForgotPasswordPage />,
    },
    {
      path: 'reset-password',
      element: <ResetPasswordPage />,
    },
  ],
  protected: [
    {
      path: 'dashboard',
      element: <Dashboard />,
    },
    {
      path: 'admin/users',
      element: <UsersPage />,
    },
    {
      path: 'profile',
      element: <ProfilePage />,
    },
    {
      path: 'exam',
      element: <ExamListPage />,
    },
    {
      path: 'exam/create',
      element: <CreateExamPage />,
    },
  ],
}

const withSuspense = (element: React.ReactNode) => (
  <Suspense fallback={<PageLoader />}>{element}</Suspense>
)

const withProtection = (element: React.ReactNode) => (
  <ProtectedRoute>{withSuspense(element)}</ProtectedRoute>
)

const withGuestOnly = (element: React.ReactNode) => (
  <GuestRoute>{withSuspense(element)}</GuestRoute>
)

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      // Public routes
      ...routes.public.map((route) => ({
        ...route,
        element: withSuspense(route.element),
      })),

      // Guest-only routes (redirects to dashboard if authenticated)
      ...routes.guestOnly.map((route) => ({
        ...route,
        element: withGuestOnly(route.element),
      })),

      // Protected routes
      ...routes.protected.map((route) => ({
        ...route,
        element: withProtection(route.element),
      })),

      // Catch-all route
      {
        path: '*',
        loader: () => redirect('/'),
      },
    ],
  },
])
