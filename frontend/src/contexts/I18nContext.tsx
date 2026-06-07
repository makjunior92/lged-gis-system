import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { dictionaries, en, projectStatusKey, projectTypeKey, roleKey, type Locale } from '@/i18n/translations';

const STORAGE_KEY = 'lged.locale';

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  /** Translate a key. Optional {placeholder} interpolation via the `vars` arg. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Translate a backend enum value to the localized display label. */
  tProjectType: (value: string) => string;
  tProjectStatus: (value: string) => string;
  tRole: (value: string) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function detectInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'bn') return stored;
  const browser = navigator.language?.toLowerCase() ?? '';
  return browser.startsWith('bn') ? 'bn' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = useCallback((l: Locale) => setLocaleState(l), []);
  const toggleLocale = useCallback(() => setLocaleState((l) => (l === 'en' ? 'bn' : 'en')), []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = dictionaries[locale];
      const raw = dict[key] ?? en[key] ?? key;
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
    },
    [locale],
  );

  const tProjectType = useCallback((v: string) => t(projectTypeKey(v)), [t]);
  const tProjectStatus = useCallback((v: string) => t(projectStatusKey(v)), [t]);
  const tRole = useCallback((v: string) => t(roleKey(v)), [t]);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, toggleLocale, t, tProjectType, tProjectStatus, tRole }),
    [locale, setLocale, toggleLocale, t, tProjectType, tProjectStatus, tRole],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within I18nProvider');
  return ctx;
}
