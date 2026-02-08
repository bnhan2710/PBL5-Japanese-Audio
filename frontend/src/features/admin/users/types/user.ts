export interface User {
  id: number;
  email: string;
  username: string;
  role: 'admin' | 'user' | 'guest';
  is_active: boolean;
  email_verified: boolean;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CreateUserData {
  email: string;
  username: string;
  role: string;
  password?: string;
}

export interface UpdateUserData {
  email?: string;
  username?: string;
  role?: string;
  is_active?: boolean;
}

export interface ResetPasswordResponse {
  message: string;
  temporary_password: string;
}
