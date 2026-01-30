import { use } from 'react'
import { StatusDot } from '../../components/ui/StatusDot'
import { useHealthStatus, HealthStatusData } from '../../hooks/useHealthStatus'

export function HealthStatus() {
  const data = use(useHealthStatus()) as HealthStatusData

  return (
    <div className="flex items-center">
      <StatusDot status={data.status} />
      <span className="text-gray-600">Status: {data.status}</span>
    </div>
  )
}
