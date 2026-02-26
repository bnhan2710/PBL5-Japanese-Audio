// Profile API Client
import { apiFetch } from '@/lib/apiClient';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ApiError {
  detail: string;
}

class ProfileApiClient {
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'API request failed');
    }
    return response.json();
  }

  // Get current user profile
  async getProfile() {
    const response = await apiFetch(`${API_BASE_URL}/api/auth/me`);
    return this.handleResponse(response);
  }

  // Update profile information
  async updateProfile(data: {
    username?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  }) {
    const response = await apiFetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Change password
  async changePassword(data: { old_password: string; new_password: string }) {
    const response = await apiFetch(`${API_BASE_URL}/api/auth/me/change-password`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return this.handleResponse<{ message: string }>(response);
  }

  // Upload avatar image
  async uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiFetch(`${API_BASE_URL}/api/auth/me/avatar`, {
      method: 'POST',
      body: formData,
    });
    return this.handleResponse<{ avatar_url: string }>(response);
  }
}

export const profileApi = new ProfileApiClient();
