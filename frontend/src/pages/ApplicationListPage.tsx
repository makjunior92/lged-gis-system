import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PlusCircle } from 'lucide-react';

import { listProjects } from '@/api/projects';
import WorkflowStatusBadge from '@/components/forms/WorkflowStatusBadge';
import { PageContainer, TableScroll } from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/contexts/I18nContext';
import { WORKFLOW_STATUSES, type Project } from '@/types/project';

interface Props {
  titleKey: string;
  subtitleKey: string;
  showAddButton?: boolean;
  addPath?: string;
  detailPathPrefix: string;
}

function ProjectCard({
  project: p,
  detailPathPrefix,
  t,
}: {
  project: Project;
  detailPathPrefix: string;
  t: (key: string) => string;
}) {
  return (
    <Link
      to={`${detailPathPrefix}/${p.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-500/40 hover:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-xs text-slate-500">{p.project_code}</div>
          <div className="font-medium text-slate-900">{p.project_name}</div>
          {p.is_duplicate_flag && (
            <span className="text-xs text-amber-600">{t('workflow.duplicate')}</span>
          )}
        </div>
        <WorkflowStatusBadge status={p.workflow_status} />
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-slate-500">{t('projects.col.type')}</dt>
          <dd>{p.project_type?.name_en ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-500">{t('projects.col.location')}</dt>
          <dd>{p.location ? `${p.location.upazila} → ${p.location.union_name}` : '—'}</dd>
        </div>
      </dl>
      <div className="mt-3 text-sm font-medium text-brand-600">{t('common.view')} →</div>
    </Link>
  );
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
    <PageContainer>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{t(titleKey)}</h1>
          <p className="text-sm text-slate-500">{t(subtitleKey)}</p>
        </div>
        {showAddButton && hasAnyRole(['Chairman']) && (
          <Link to={addPath} className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">
              <PlusCircle size={16} className="mr-1" />
              {t('applications.newApplication')}
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:p-4">
        <Input
          className="w-full min-w-0 flex-1"
          placeholder={t('projects.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          className="w-full sm:w-48"
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

      <div className="space-y-3 md:hidden">
        {query.isLoading && (
          <div className="rounded-lg border bg-white p-8 text-center text-slate-500">{t('common.loading')}</div>
        )}
        {!query.isLoading && items.length === 0 && (
          <div className="rounded-lg border bg-white p-8 text-center text-slate-500">{t('projects.empty')}</div>
        )}
        {items.map((p) => (
          <ProjectCard key={p.id} project={p} detailPathPrefix={detailPathPrefix} t={t} />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
        <TableScroll>
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
        </TableScroll>
      </div>
    </PageContainer>
  );
}
