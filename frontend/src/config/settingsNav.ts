export interface SettingsNavLink {
  to: string;
  labelKey: string;
}

export interface SettingsNavGroup {
  labelKey: string;
  links: SettingsNavLink[];
}

export const SETTINGS_DEFAULT_PATH = '/settings/user-forms/chairman';

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    labelKey: 'settings.group.userForms',
    links: [
      { to: '/settings/user-forms/chairman', labelKey: 'settings.chairmanUserForm' },
      { to: '/settings/user-forms/pio', labelKey: 'settings.pioUserForm' },
      { to: '/settings/user-forms/uno', labelKey: 'settings.unoUserForm' },
    ],
  },
  {
    labelKey: 'settings.group.project',
    links: [
      { to: '/settings/project/form', labelKey: 'settings.projectForm' },
      { to: '/settings/project/types', labelKey: 'settings.projectTypes' },
    ],
  },
  {
    labelKey: 'settings.group.permissions',
    links: [
      { to: '/settings/permissions/pio', labelKey: 'settings.pioPermissions' },
    ],
  },
  {
    labelKey: 'settings.group.review',
    links: [
      { to: '/settings/review/assessment-rules', labelKey: 'settings.assessmentRules' },
      { to: '/settings/review/uno', labelKey: 'settings.unoReview' },
    ],
  },
];

export function findSettingsGroupForPath(pathname: string): string | null {
  for (const group of SETTINGS_NAV_GROUPS) {
    if (group.links.some((l) => pathname === l.to || pathname.startsWith(`${l.to}/`))) {
      return group.labelKey;
    }
  }
  return null;
}
