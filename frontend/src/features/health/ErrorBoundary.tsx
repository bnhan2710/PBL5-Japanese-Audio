import { StatusDot } from '../../components/ui/StatusDot'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorType {
  message?: string
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  let error: ErrorType | undefined = undefined
  try {
    return children
  } catch (e) {
    error = e as ErrorType
  }

  return (
    <div className="flex items-center">
      <StatusDot status="error" />
      <span className="text-red-600">Error: {error?.message || 'Something went wrong'}</span>
    </div>
  )
}
