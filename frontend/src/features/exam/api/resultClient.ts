import { apiFetch } from '@/lib/apiClient'
import { TestResultReviewResponse } from '../../test/types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface UserResultResponse {
  result_id: string
  user_id: number | null
  exam_id: string | null
  exam_title: string | null
  score: number | null
  total_questions: number | null
  correct_answers: number | null
  completed_at: string
}

export interface UserResultListResponse {
  results: UserResultResponse[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'API error')
  }
  return res.json()
}

export const resultClient = {
  getMyResults: async (page = 1, pageSize = 10): Promise<UserResultListResponse> => {
    const res = await apiFetch(`${API_BASE}/api/results/me?page=${page}&page_size=${pageSize}`)
    return handleResponse<UserResultListResponse>(res)
  },
  getResultReview: async (resultId: string): Promise<TestResultReviewResponse> => {
    const res = await apiFetch(`${API_BASE}/api/test/results/${resultId}/review`)
    return handleResponse<TestResultReviewResponse>(res)
  },
}
