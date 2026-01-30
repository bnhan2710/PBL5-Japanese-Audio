export interface HealthStatusData {
  status: 'healthy' | 'error' | 'loading'
  message?: string
}

// Cache the promise to avoid creating a new one on every render
let healthPromise: Promise<HealthStatusData> | null = null

export function useHealthStatus(): Promise<HealthStatusData> {
  if (!healthPromise) {
    healthPromise = fetchHealthStatus()
  }
  return healthPromise
}

async function fetchHealthStatus(): Promise<HealthStatusData> {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/health`)
    if (!response.ok) return { status: 'error' }
    const data = await response.json()
    return data as HealthStatusData
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { status: 'error', message: errorMessage }
  }
}
