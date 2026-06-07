import { api } from '@/lib/api';
import type { Paginated } from '@/types/common';
import type {
  Role,
  TemporaryPasswordResponse,
  User,
  UserCreatePayload,
  UserUpdatePayload,
} from '@/types/user';

export interface UserListFilters {
  page?: number;
  page_size?: number;
  search?: string;
  role?: Role;
  is_active?: boolean;
}

export async function listUsers(filters: UserListFilters = {}): Promise<Paginated<User>> {
  const params: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') params[k] = v as string | number | boolean;
  }
  const res = await api.get<Paginated<User>>('/users/', { params });
  return res.data;
}

export async function getUser(id: number): Promise<User> {
  const res = await api.get<User>(`/users/${id}`);
  return res.data;
}

export async function createUser(payload: UserCreatePayload): Promise<User> {
  const res = await api.post<User>('/users/', payload);
  return res.data;
}

export async function updateUser(id: number, payload: UserUpdatePayload): Promise<User> {
  const res = await api.patch<User>(`/users/${id}`, payload);
  return res.data;
}

export async function resetUserPassword(id: number): Promise<TemporaryPasswordResponse> {
  const res = await api.post<TemporaryPasswordResponse>(`/users/${id}/reset-password`);
  return res.data;
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/users/${id}`);
}
