import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { DESKTOP_SIDEBAR_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';

interface LayoutContextValue {
  /** True at lg breakpoint and above — sidebar can expand/collapse. */
  isDesktop: boolean;
  /** Icon-only rail on mobile; on desktop when user collapses the sidebar. */
  sidebarIconOnly: boolean;
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery(DESKTOP_SIDEBAR_QUERY);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!isDesktop) {
      setSidebarCollapsed(false);
    }
  }, [isDesktop]);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const sidebarIconOnly = !isDesktop || sidebarCollapsed;

  const value = useMemo(
    () => ({
      isDesktop,
      sidebarIconOnly,
      sidebarCollapsed,
      toggleSidebarCollapsed,
    }),
    [isDesktop, sidebarIconOnly, sidebarCollapsed, toggleSidebarCollapsed],
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) {
    throw new Error('useLayout must be used within LayoutProvider');
  }
  return ctx;
}
