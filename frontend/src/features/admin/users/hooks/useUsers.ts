import { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminClient';
import type { UserListResponse } from '../types/user';

interface UseUsersParams {
  email?: string;
  username?: string;
  role?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

export function useUsers(params: UseUsersParams) {
  const [data, setData] = useState<UserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApi.listUsers(params);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [
    params.email,
    params.username,
    params.role,
    params.is_active,
    params.page,
    params.page_size,
  ]);

  return { data, loading, error, refetch: fetchUsers };
}
