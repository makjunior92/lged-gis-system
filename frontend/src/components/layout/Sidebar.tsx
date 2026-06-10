import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  List,
  PlusCircle,
  ClipboardCheck,
  Stamp,
  Users,
  Settings,
  FolderKanban,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import SiteLogo from '@/components/layout/SiteLogo';
import { SidebarIconButton, SidebarNavItem } from '@/components/layout/SidebarNavItem';
import { useAuth } from '@/contexts/AuthContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useT } from '@/contexts/I18nContext';
import {
  SETTINGS_NAV_GROUPS,
  SETTINGS_FLAT_LINKS,
  findSettingsGroupForPath,
} from '@/config/settingsNav';
import type { Role } from '@/types/user';

interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof List;
  roles: Role[];
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/applications', labelKey: 'nav.myApplications', icon: List, roles: ['Chairman'] },
  { to: '/applications/new', labelKey: 'nav.submitApplication', icon: PlusCircle, roles: ['Chairman'] },
  { to: '/pio/review', labelKey: 'nav.pioReview', icon: ClipboardCheck, roles: ['PIO'] },
  { to: '/uno/approvals', labelKey: 'nav.unoApprovals', icon: Stamp, roles: ['UNO'] },
  { to: '/admin/projects', labelKey: 'nav.allProjects', icon: FolderKanban, roles: ['Super Admin', 'Admin'] },
  { to: '/users', labelKey: 'nav.userMgmt', icon: Users, roles: ['Super Admin', 'Admin'] },
];

const ADMIN_ROLES: Role[] = ['Super Admin', 'Admin'];

export default function Sidebar() {
  const { user } = useAuth();
  const { t } = useT();
  const { sidebarIconOnly } = useLayout();
  const location = useLocation();
  const items = NAV.filter((n) => user && n.roles.includes(user.role));
  const showSettings = user && ADMIN_ROLES.includes(user.role);

  const isSettingsRoute = location.pathname.startsWith('/settings');
  const [settingsOpen, setSettingsOpen] = useState(isSettingsRoute);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isSettingsRoute && !sidebarIconOnly) {
      setSettingsOpen(true);
      const activeGroup = findSettingsGroupForPath(location.pathname);
      if (activeGroup) {
        setOpenGroups((prev) => ({ ...prev, [activeGroup]: true }));
      }
    }
  }, [location.pathname, isSettingsRoute, sidebarIconOnly]);

  function toggleGroup(labelKey: string) {
    setOpenGroups((prev) => ({ ...prev, [labelKey]: !prev[labelKey] }));
  }

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col bg-brand-500 text-brand-50 transition-[width] duration-200 ease-in-out',
        sidebarIconOnly ? 'w-14 sm:w-16' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex items-center border-b border-brand-600',
          sidebarIconOnly ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-4',
        )}
      >
        <SiteLogo size={sidebarIconOnly ? 'sm' : 'md'} className="ring-2 ring-white/30" />
        {!sidebarIconOnly && (
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold">{t('app.title')}</div>
            <div className="truncate text-xs text-brand-100/80">{t('app.subtitle')}</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-1.5 py-3 sm:px-2">
        {items.map((item) => (
          <SidebarNavItem
            key={item.to}
            to={item.to}
            label={t(item.labelKey)}
            icon={item.icon}
            iconOnly={sidebarIconOnly}
            end={item.end ?? (item.to === '/applications' || item.to === '/pio/review' || item.to === '/uno/approvals')}
          />
        ))}

        {showSettings && sidebarIconOnly && (
          <div className="mt-2 space-y-0.5 border-t border-brand-600/80 pt-2">
            {SETTINGS_FLAT_LINKS.map((link) => {
              const Icon = link.icon;
              const label = t(link.labelKey);
              const isActive =
                location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  title={label}
                  aria-label={label}
                  className={cn(
                    'flex items-center justify-center rounded-md px-2 py-2.5 text-sm transition-colors',
                    isActive
                      ? 'bg-brand-700 text-white'
                      : 'text-brand-50 hover:bg-brand-600 hover:text-white',
                  )}
                >
                  <Icon size={20} className="shrink-0" />
                </NavLink>
              );
            })}
          </div>
        )}

        {showSettings && !sidebarIconOnly && (
          <div className="mt-1">
            <SidebarIconButton
              label={t('nav.settings')}
              icon={Settings}
              active={isSettingsRoute}
              iconOnly={false}
              onClick={() => setSettingsOpen((o) => !o)}
            >
              <ChevronRight
                size={16}
                className={cn('shrink-0 transition-transform duration-200', settingsOpen && 'rotate-90')}
              />
            </SidebarIconButton>

            {settingsOpen && (
              <div className="ml-3 mt-0.5 space-y-0.5 border-l border-brand-400/50 pl-2">
                {SETTINGS_NAV_GROUPS.map((group) => {
                  const groupOpen = openGroups[group.labelKey] ?? false;
                  const groupActive = group.links.some(
                    (l) => location.pathname === l.to || location.pathname.startsWith(`${l.to}/`),
                  );

                  return (
                    <div key={group.labelKey}>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.labelKey)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors',
                          groupActive
                            ? 'text-white'
                            : 'text-brand-100/90 hover:bg-brand-600/60 hover:text-white',
                        )}
                      >
                        <ChevronRight
                          size={14}
                          className={cn('shrink-0 transition-transform duration-200', groupOpen && 'rotate-90')}
                        />
                        <span className="leading-snug">{t(group.labelKey)}</span>
                      </button>

                      {groupOpen && (
                        <div className="ml-3 space-y-0.5 border-l border-brand-400/40 pl-2">
                          {group.links.map((link) => {
                            const LinkIcon = link.icon;
                            return (
                              <NavLink
                                key={link.to}
                                to={link.to}
                                className={({ isActive }) =>
                                  cn(
                                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                                    isActive
                                      ? 'bg-brand-700 font-medium text-white'
                                      : 'text-brand-100/80 hover:bg-brand-600/60 hover:text-white',
                                  )
                                }
                              >
                                <LinkIcon size={14} className="shrink-0 opacity-90" />
                                <span className="leading-snug">{t(link.labelKey)}</span>
                              </NavLink>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      {!sidebarIconOnly && (
        <div className="border-t border-brand-600 px-4 py-3 text-xs text-brand-100/70">
          <div>{t('app.subtitle')}</div>
          <div className="opacity-70">{t('app.copy')}</div>
        </div>
      )}
    </aside>
  );
}
