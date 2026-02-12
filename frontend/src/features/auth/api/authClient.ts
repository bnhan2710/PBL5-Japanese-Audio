const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ApiError {
  detail: string;
}

class AuthApiClient {
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'API request failed');
    }
    return response.json();
  }

  // Request password reset
  async requestPasswordReset(email: string) {
    const response = await fetch(`${API_BASE_URL}/api/auth/request-password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    return this.handleResponse<{ message: string }>(response);
  }

  // Reset password
  async resetPassword(token: string, newPassword: string) {
    const queryParams = new URLSearchParams({ token, new_password: newPassword });
    const response = await fetch(`${API_BASE_URL}/api/auth/reset-password?${queryParams}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return this.handleResponse<{ message: string }>(response);
  }
}

export const authApi = new AuthApiClient();
