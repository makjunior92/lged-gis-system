import type { User, Role } from '@/types/user';

const STAFF_ROLES: Role[] = ['Super Admin', 'Admin', 'PIO', 'UNO'];

export function isStaffRole(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function isChairmanRole(role: Role): boolean {
  return role === 'Chairman';
}

/** Primary list identifier: NID for chairmen, govt employee ID for staff. */
export function userListIdentifier(user: User): { primary: string; secondary?: string } {
  if (user.role === 'Chairman') {
    const primary = user.nid_number?.trim() || '—';
    const secondary = user.region
      ? `${user.region.upazila} · ${user.region.union_name}`
      : undefined;
    return { primary, secondary };
  }
  return {
    primary: user.employee_id?.trim() || '—',
    secondary: user.designation ?? undefined,
  };
}
