import { useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Languages } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/contexts/I18nContext';
import { extractErrorMessage } from '@/lib/api';
import SiteLogo from '@/components/layout/SiteLogo';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

const schema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().trim().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { signIn, isAuthenticated } = useAuth();
  const { t, locale, toggleLocale } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (isAuthenticated) {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const username = values.username;
    const password = values.password;
    try {
      await signIn(username, password);
      const from = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
    } catch (err) {
      const msg = extractErrorMessage(err, t('login.failed'));
      toast.error(`${msg} — ${t('login.demoPasswordHint')}`);
    } finally {
      setSubmitting(false);
    }
  }

  const otherLocaleLabel = locale === 'en' ? 'বাংলা' : 'English';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-2xl relative">
        <button
          onClick={toggleLocale}
          title={`Switch language → ${otherLocaleLabel}`}
          className="absolute right-3 top-3 inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <Languages size={12} />
          {otherLocaleLabel}
        </button>

        <div className="mb-6 text-center">
          <SiteLogo size="lg" className="mx-auto mb-3 ring-2 ring-slate-100" />
          <h1 className="text-xl font-bold text-slate-800">{t('app.title')}</h1>
          <p className="text-sm text-slate-500">{t('login.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label={t('common.username')}
            placeholder="admin"
            autoComplete="username"
            required
            {...register('username')}
            error={errors.username?.message}
          />
          <Input
            label={t('common.password')}
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            {...register('password')}
            error={errors.password?.message}
          />
          <Button type="submit" isLoading={submitting} className="w-full">
            {t('common.signIn')}
          </Button>
        </form>

        <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <div className="font-semibold mb-1 text-slate-700">{t('login.demoTitle')}</div>
          <div><code>admin / Admin@123</code> &nbsp;(Super Admin)</div>
          <div><code>pio.feni / Flow@2026</code> &nbsp;(PIO)</div>
          <div><code>uno.feni / Flow@2026</code> &nbsp;(UNO)</div>
          <div><code>chairman.dharmapur / Flow@2026</code> &nbsp;(Chairman)</div>
          <div><code>chairman.sharshadi / Flow@2026</code> &nbsp;(Chairman)</div>
          <p className="mt-2 text-slate-500">{t('login.demoResetHint')}</p>
        </div>
      </div>
    </div>
  );
}
