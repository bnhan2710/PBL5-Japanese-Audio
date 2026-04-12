import { apiFetch } from '@/lib/apiClient'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'API error')
  }
  return res.json()
}

export type AIPhotoType = 'context' | 'action'

export interface AIPhotoGeneratePayload {
  photo_type: AIPhotoType
  description: string
  question_text?: string | null
  script?: string | null
  answers?: string[] | null
}

export interface AIPhotoGenerateResponse {
  b64_image: string
  info?: string | null
  storage_path?: string | null
}

export const aiPhotoClient = {
  generate: (data: AIPhotoGeneratePayload) =>
    apiFetch(`${API_BASE}/api/ai_photos/generate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((r) => handleResponse<AIPhotoGenerateResponse>(r)),
}
