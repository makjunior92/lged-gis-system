import { LogOut, Languages, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLayout } from '@/contexts/LayoutContext';
import { useT } from '@/contexts/I18nContext';
import SiteLogo from '@/components/layout/SiteLogo';
import Button from '@/components/ui/Button';

export default function Header() {
  const { user, signOut } = useAuth();
  const { t, tRole, locale, toggleLocale } = useT();
  const { isDesktop, sidebarCollapsed, toggleSidebarCollapsed } = useLayout();
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  const otherLocaleLabel = locale === 'en' ? 'বাংলা' : 'English';

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 shadow-sm sm:px-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {isDesktop && (
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
            title={sidebarCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
            aria-label={sidebarCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
          >
            {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}
        <SiteLogo size="sm" className="shrink-0 ring-1 ring-slate-200 lg:hidden" />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-slate-800 sm:text-base">{t('app.title')}</h1>
          <p className="hidden truncate text-xs text-slate-500 sm:block">{t('app.subtitle')}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <button
          onClick={toggleLocale}
          title={`Switch language → ${otherLocaleLabel}`}
          className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 sm:px-3 sm:gap-1.5"
        >
          <Languages size={14} />
          <span className="hidden sm:inline">{otherLocaleLabel}</span>
        </button>

        {user && (
          <div className="hidden text-right leading-tight md:block">
            <div className="max-w-[140px] truncate text-sm font-medium text-slate-800 lg:max-w-none">
              {locale === 'bn' && user.full_name_bn ? user.full_name_bn : user.full_name}
            </div>
            <div className="text-xs text-slate-500">{tRole(user.role)}</div>
          </div>
        )}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600 ring-1 ring-slate-300">
          {user ? user.full_name.charAt(0).toUpperCase() : '?'}
        </div>
        <Button size="sm" variant="outline" onClick={handleSignOut} className="px-2 sm:px-3">
          <LogOut size={14} />
          <span className="hidden sm:inline">{t('common.logout')}</span>
        </Button>
      </div>
    </header>
  );
}
