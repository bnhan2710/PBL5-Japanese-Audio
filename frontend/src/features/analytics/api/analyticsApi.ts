import { apiFetch } from '@/lib/apiClient'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface ChartDataPoint {
  name: string
  value: number
}

export interface AnalyticsOverviewResponse {
  exam_stats: {
    total: number
    by_level: ChartDataPoint[]
    by_status: ChartDataPoint[]
    created_over_time: ChartDataPoint[]
  }
  interaction_stats: {
    total_takes: number
    over_time: ChartDataPoint[]
  }
  ai_quality_stats: {
    reliability_score: number
    confidence_error: number
    average_rating: number
    rating_distribution: ChartDataPoint[]
  }
  system_quality_stats: {
    total_feedbacks: number
    average_rating: number
    rating_distribution: ChartDataPoint[]
  }
}

export interface AnalyticsFeedbackResponse {
  id: string
  type: string
  user_id: number
  user_name: string
  rating_score: number
  comment_text?: string
  created_at: string
}

export interface FeedbackListResponse {
  items: AnalyticsFeedbackResponse[]
  total: number
}

class AnalyticsApiClient {
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail || 'API request failed')
    }
    return response.json()
  }

  async getOverview(params?: {
    start_date?: string
    end_date?: string
    level?: string
  }): Promise<AnalyticsOverviewResponse> {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) queryParams.append(key, value)
      })
    }

    const response = await apiFetch(`${API_BASE_URL}/api/analytics/overview?${queryParams}`)
    return this.handleResponse<AnalyticsOverviewResponse>(response)
  }

  async getFeedbacks(params?: {
    start_date?: string
    end_date?: string
    type_filter?: string
    rating?: number
  }): Promise<FeedbackListResponse> {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value))
      })
    }

    const response = await apiFetch(`${API_BASE_URL}/api/analytics/ai-feedbacks?${queryParams}`)
    return this.handleResponse<FeedbackListResponse>(response)
  }
}

export const analyticsApi = new AnalyticsApiClient()
