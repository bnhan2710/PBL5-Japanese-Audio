type StatusType = 'healthy' | 'error' | 'loading'

interface StatusDotProps {
  status: StatusType
}

export function StatusDot({ status }: StatusDotProps) {
  const colors: Record<StatusType, string> = {
    healthy: 'bg-green-500',
    error: 'bg-red-500',
    loading: 'bg-gray-300 animate-pulse',
  }

  return <div className={`w-3 h-3 rounded-full mr-2 ${colors[status] || colors.error}`} />
}
