export const ROLES = [
  'Super Admin',
  'Admin',
  'Chairman',
  'PIO',
  'UNO',
] as const;
export type Role = (typeof ROLES)[number];

export interface RegionSummary {
  id: number;
  division: string;
  district: string;
  upazila: string;
  union_name: string;
}

export interface User {
  id: number;
  username: string;
  full_name: string;
  full_name_bn?: string | null;
  email?: string | null;
  employee_id?: string | null;
  designation?: string | null;
  role: Role;
  nid_number?: string | null;
  address?: string | null;
  assigned_region?: number | null;
  assigned_upazila_key?: string | null;
  region?: RegionSummary | null;
  custom_data: Record<string, unknown>;
  is_active: boolean;
  last_login?: string | null;
  created_at: string;
}

export interface UserCreatePayload {
  username: string;
  password: string;
  full_name: string;
  full_name_bn?: string;
  email?: string;
  employee_id?: string | null;
  designation?: string;
  role: Role;
  nid_number?: string;
  address?: string;
  assigned_region?: number | null;
  assigned_upazila_key?: string | null;
  custom_data?: Record<string, unknown>;
}

export interface UserUpdatePayload {
  username?: string;
  full_name?: string;
  full_name_bn?: string;
  email?: string;
  employee_id?: string | null;
  designation?: string | null;
  role?: Role;
  nid_number?: string | null;
  address?: string | null;
  assigned_region?: number | null;
  assigned_upazila_key?: string | null;
  custom_data?: Record<string, unknown>;
  is_active?: boolean;
}

export interface TemporaryPasswordResponse {
  user_id: number;
  username: string;
  temporary_password: string;
  message: string;
}
