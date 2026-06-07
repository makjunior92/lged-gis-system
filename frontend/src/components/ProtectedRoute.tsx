import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/contexts/I18nContext';
import Spinner from './ui/Spinner';
import type { Role } from '@/types/user';

interface Props {
  children: ReactNode;
  requireRoles?: Role[];
}

export default function ProtectedRoute({ children, requireRoles }: Props) {
  const { isAuthenticated, isLoading, hasAnyRole } = useAuth();
  const { t, tRole } = useT();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (requireRoles && requireRoles.length > 0 && !hasAnyRole(requireRoles)) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold text-slate-800">{t('common.accessDenied')}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {t('common.noPermission')} {t('common.requiredRole')}: {requireRoles.map(tRole).join(' / ')}.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
