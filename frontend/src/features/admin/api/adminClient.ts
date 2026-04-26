// Admin API Client
import { apiFetch } from '@/lib/apiClient'
import type { AdminAudioListResponse } from '../audio/types/audio'
import type {
  ResetPasswordResponse,
  UpdateUserData,
  User,
  UserListResponse,
} from '../users/types/user'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface ApiError {
  detail: string
}

class AdminApiClient {
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = await response.json()
      throw new Error(error.detail || 'API request failed')
    }
    return response.json()
  }

  // Upload avatar file — returns the public avatar URL
  async uploadAvatar(file: File): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiFetch(`${API_BASE_URL}/api/auth/me/avatar`, {
      method: 'POST',
      body: formData,
    })
    const data = await this.handleResponse<{ avatar_url: string }>(response)
    return data.avatar_url
  }

  // List users with filters
  async listUsers(params: {
    email?: string
    username?: string
    role?: string
    is_active?: boolean
    page?: number
    page_size?: number
  }): Promise<UserListResponse> {
    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams.append(key, String(value))
      }
    })

    const response = await apiFetch(`${API_BASE_URL}/api/users?${queryParams}`)
    return this.handleResponse<UserListResponse>(response)
  }

  async listAudios(params: {
    q?: string
    ai_status?: string
    page?: number
    page_size?: number
  }): Promise<AdminAudioListResponse> {
    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams.append(key, String(value))
      }
    })

    const response = await apiFetch(`${API_BASE_URL}/api/audios?${queryParams}`)
    return this.handleResponse<AdminAudioListResponse>(response)
  }

  // Get user by ID
  async getUser(userId: number): Promise<User> {
    const response = await apiFetch(`${API_BASE_URL}/api/users/${userId}`)
    return this.handleResponse<User>(response)
  }

  // Create user
  async createUser(data: {
    email: string
    username: string
    role: string
    password?: string
    first_name?: string
    last_name?: string
    avatar_url?: string
  }): Promise<User> {
    const response = await apiFetch(`${API_BASE_URL}/api/users`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return this.handleResponse<User>(response)
  }

  // Update user
  async updateUser(userId: number, data: UpdateUserData): Promise<User> {
    const response = await apiFetch(`${API_BASE_URL}/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return this.handleResponse<User>(response)
  }

  // Lock user
  async lockUser(
    userId: number,
    durationHours: number,
    reason: string,
    detailedReason?: string
  ): Promise<User> {
    const response = await apiFetch(`${API_BASE_URL}/api/users/${userId}/lock`, {
      method: 'POST',
      body: JSON.stringify({
        duration_hours: durationHours,
        reason,
        detailed_reason: detailedReason,
      }),
    })
    return this.handleResponse<User>(response)
  }

  // Unlock user
  async unlockUser(userId: number): Promise<User> {
    const response = await apiFetch(`${API_BASE_URL}/api/users/${userId}/unlock`, {
      method: 'POST',
    })
    return this.handleResponse<User>(response)
  }

  // Reset password
  async resetPassword(userId: number): Promise<ResetPasswordResponse> {
    const response = await apiFetch(`${API_BASE_URL}/api/users/${userId}/reset-password`, {
      method: 'POST',
    })
    return this.handleResponse<ResetPasswordResponse>(response)
  }
}

export const adminApi = new AdminApiClient()
