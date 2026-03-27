import { apiFetch } from '@/lib/apiClient'
import { TestExamDetail, TestSubmitPayload, TestSubmitResult } from '../types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    throw new Error(error.detail || 'API request failed')
  }
  return response.json()
}

export const testClient = {
  getExamDetail: (examId: string) =>
    apiFetch(`${API_BASE}/api/test/exams/${examId}`).then((response) =>
      handleResponse<TestExamDetail>(response)
    ),

  submitExam: (examId: string, payload: TestSubmitPayload) =>
    apiFetch(`${API_BASE}/api/test/exams/${examId}/submit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((response) => handleResponse<TestSubmitResult>(response)),
}
