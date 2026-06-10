import {
  Briefcase,
  ClipboardList,
  FileText,
  KeyRound,
  Scale,
  Shield,
  Tags,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

export interface SettingsNavLink {
  to: string;
  labelKey: string;
  icon: LucideIcon;
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
      { to: '/settings/user-forms/chairman', labelKey: 'settings.chairmanUserForm', icon: UserRound },
      { to: '/settings/user-forms/pio', labelKey: 'settings.pioUserForm', icon: Briefcase },
      { to: '/settings/user-forms/uno', labelKey: 'settings.unoUserForm', icon: Shield },
    ],
  },
  {
    labelKey: 'settings.group.project',
    links: [
      { to: '/settings/project/form', labelKey: 'settings.projectForm', icon: FileText },
      { to: '/settings/project/types', labelKey: 'settings.projectTypes', icon: Tags },
    ],
  },
  {
    labelKey: 'settings.group.permissions',
    links: [
      { to: '/settings/permissions/pio', labelKey: 'settings.pioPermissions', icon: KeyRound },
    ],
  },
  {
    labelKey: 'settings.group.review',
    links: [
      { to: '/settings/review/assessment-rules', labelKey: 'settings.assessmentRules', icon: Scale },
      { to: '/settings/review/uno', labelKey: 'settings.unoReview', icon: ClipboardList },
    ],
  },
];

export const SETTINGS_FLAT_LINKS: SettingsNavLink[] = SETTINGS_NAV_GROUPS.flatMap((g) => g.links);

export function findSettingsGroupForPath(pathname: string): string | null {
  for (const group of SETTINGS_NAV_GROUPS) {
    if (group.links.some((l) => pathname === l.to || pathname.startsWith(`${l.to}/`))) {
      return group.labelKey;
    }
  }
  return null;
}
