import { LogOut, Languages } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/contexts/I18nContext';
import SiteLogo from '@/components/layout/SiteLogo';
import Button from '@/components/ui/Button';

export default function Header() {
  const { user, signOut } = useAuth();
  const { t, tRole, locale, toggleLocale } = useT();
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  // Show the OPPOSITE locale on the toggle button (it's the action, not the state).
  const otherLocaleLabel = locale === 'en' ? 'বাংলা' : 'English';

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
      <div className="flex items-center gap-3">
        <SiteLogo size="sm" className="hidden sm:block ring-1 ring-slate-200" />
        <div>
          <h1 className="text-base font-semibold text-slate-800">{t('app.title')}</h1>
          <p className="text-xs text-slate-500">{t('app.subtitle')}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggleLocale}
          title={`Switch language → ${otherLocaleLabel}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Languages size={14} />
          {otherLocaleLabel}
        </button>

        {user && (
          <div className="text-right leading-tight">
            <div className="text-sm font-medium text-slate-800">
              {locale === 'bn' && user.full_name_bn ? user.full_name_bn : user.full_name}
            </div>
            <div className="text-xs text-slate-500">{tRole(user.role)}</div>
          </div>
        )}
        <div className="h-9 w-9 rounded-full bg-slate-200 ring-1 ring-slate-300 flex items-center justify-center text-slate-600 text-sm font-semibold">
          {user ? user.full_name.charAt(0).toUpperCase() : '?'}
        </div>
        <Button size="sm" variant="outline" onClick={handleSignOut}>
          <LogOut size={14} />
          {t('common.logout')}
        </Button>
      </div>
    </header>
  );
}
