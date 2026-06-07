import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PlusCircle } from 'lucide-react';

import { listProjects } from '@/api/projects';
import WorkflowStatusBadge from '@/components/forms/WorkflowStatusBadge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/contexts/I18nContext';
import { WORKFLOW_STATUSES } from '@/types/project';

interface Props {
  titleKey: string;
  subtitleKey: string;
  showAddButton?: boolean;
  addPath?: string;
  detailPathPrefix: string;
}

export default function ApplicationListPage({
  titleKey,
  subtitleKey,
  showAddButton,
  addPath = '/applications/new',
  detailPathPrefix,
}: Props) {
  const { t } = useT();
  const { hasAnyRole } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const query = useQuery({
    queryKey: ['projects', { search, status }],
    queryFn: () => listProjects({ search: search || undefined, status: status || undefined }),
  });

  const items = query.data?.items ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t(titleKey)}</h1>
          <p className="text-sm text-slate-500">{t(subtitleKey)}</p>
        </div>
        {showAddButton && hasAnyRole(['Chairman']) && (
          <Link to={addPath}>
            <Button>
              <PlusCircle size={16} className="mr-1" />
              {t('applications.newApplication')}
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <Input
          className="min-w-[200px] flex-1"
          placeholder={t('projects.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          className="w-48"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{t('common.allStatuses')}</option>
          {WORKFLOW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t('workflowStatus.' + s.replace(/\s+/g, '')) !== 'workflowStatus.' + s.replace(/\s+/g, '')
                ? t('workflowStatus.' + s.replace(/\s+/g, ''))
                : s}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{t('projects.col.code')}</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{t('projects.col.name')}</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{t('projects.col.type')}</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{t('projects.col.location')}</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{t('projects.col.status')}</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {query.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">{t('common.loading')}</td>
              </tr>
            )}
            {!query.isLoading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">{t('projects.empty')}</td>
              </tr>
            )}
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">{p.project_code}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{p.project_name}</div>
                  {p.is_duplicate_flag && (
                    <span className="text-xs text-amber-600">{t('workflow.duplicate')}</span>
                  )}
                </td>
                <td className="px-4 py-3">{p.project_type?.name_en ?? '—'}</td>
                <td className="px-4 py-3">
                  {p.location ? `${p.location.upazila} → ${p.location.union_name}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <WorkflowStatusBadge status={p.workflow_status} />
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`${detailPathPrefix}/${p.id}`}
                    className="text-brand-600 hover:underline"
                  >
                    {t('common.view')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
