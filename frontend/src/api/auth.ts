import { api } from '@/lib/api';
import type { LoginRequest, LoginResponse } from '@/types/auth';
import type { User } from '@/types/user';

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>('/auth/login', payload);
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await api.get<User>('/auth/me');
  return res.data;
}
