// Admin API Client
import { apiFetch } from '@/lib/apiClient';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ApiError {
  detail: string;
}

class AdminApiClient {
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'API request failed');
    }
    return response.json();
  }

  // Upload avatar file — returns the public avatar URL
  async uploadAvatar(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiFetch(`${API_BASE_URL}/api/auth/me/avatar`, {
      method: 'POST',
      body: formData,
    });
    const data = await this.handleResponse<{ avatar_url: string }>(response);
    return data.avatar_url;
  }

  // List users with filters
  async listUsers(params: {
    email?: string;
    username?: string;
    role?: string;
    is_active?: boolean;
    page?: number;
    page_size?: number;
  }) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        queryParams.append(key, String(value));
      }
    });

    const response = await apiFetch(
      `${API_BASE_URL}/api/users?${queryParams}`
    );
    return this.handleResponse(response);
  }

  // Get user by ID
  async getUser(userId: number) {
    const response = await apiFetch(
      `${API_BASE_URL}/api/users/${userId}`
    );
    return this.handleResponse(response);
  }

  // Create user
  async createUser(data: {
    email: string;
    username: string;
    role: string;
    password?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  }) {
    const response = await apiFetch(
      `${API_BASE_URL}/api/users`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return this.handleResponse(response);
  }

  // Update user
  async updateUser(userId: number, data: {
    email?: string;
    username?: string;
    role?: string;
    is_active?: boolean;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  }) {
    const response = await apiFetch(
      `${API_BASE_URL}/api/users/${userId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
    return this.handleResponse(response);
  }

  // Lock user
  async lockUser(userId: number, durationHours: number) {
    const response = await apiFetch(
      `${API_BASE_URL}/api/users/${userId}/lock`,
      {
        method: 'POST',
        body: JSON.stringify({ duration_hours: durationHours }),
      }
    );
    return this.handleResponse(response);
  }

  // Unlock user
  async unlockUser(userId: number) {
    const response = await apiFetch(
      `${API_BASE_URL}/api/users/${userId}/unlock`,
      { method: 'POST' }
    );
    return this.handleResponse(response);
  }

  // Reset password
  async resetPassword(userId: number) {
    const response = await apiFetch(
      `${API_BASE_URL}/api/users/${userId}/reset-password`,
      { method: 'POST' }
    );
    return this.handleResponse(response);
  }
}

export const adminApi = new AdminApiClient();

