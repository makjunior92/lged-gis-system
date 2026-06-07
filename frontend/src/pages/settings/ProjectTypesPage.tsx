import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { createProjectType, deleteProjectType, listProjectTypes } from '@/api/projectTypes';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useT } from '@/contexts/I18nContext';
import { extractErrorMessage } from '@/lib/api';

export default function ProjectTypesPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameBn, setNameBn] = useState('');

  const query = useQuery({
    queryKey: ['project-types', false],
    queryFn: () => listProjectTypes(false),
  });

  const createMutation = useMutation({
    mutationFn: () => createProjectType({ code, name_en: nameEn, name_bn: nameBn || undefined }),
    onSuccess: () => {
      toast.success(t('settings.typeCreated'));
      setCode('');
      setNameEn('');
      setNameBn('');
      qc.invalidateQueries({ queryKey: ['project-types'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProjectType(id),
    onSuccess: () => {
      toast.success(t('settings.typeDeleted'));
      qc.invalidateQueries({ queryKey: ['project-types'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t('settings.projectTypes')}</h1>
        <p className="text-sm text-slate-500">{t('settings.projectTypesDesc')}</p>
      </div>

      <div className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-4">
        <Input label={t('settings.typeCode')} value={code} onChange={(e) => setCode(e.target.value)} />
        <Input label={t('settings.labelEn')} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        <Input label={t('settings.labelBn')} value={nameBn} onChange={(e) => setNameBn(e.target.value)} />
        <div className="flex items-end">
          <Button onClick={() => createMutation.mutate()} isLoading={createMutation.isPending} disabled={!code || !nameEn}>
            {t('common.create')}
          </Button>
        </div>
      </div>

      <table className="min-w-full divide-y divide-slate-200 rounded-lg border bg-white text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left">{t('settings.typeCode')}</th>
            <th className="px-4 py-2 text-left">{t('settings.labelEn')}</th>
            <th className="px-4 py-2 text-left">{t('common.status')}</th>
            <th className="px-4 py-2 text-left">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(query.data ?? []).map((pt) => (
            <tr key={pt.id}>
              <td className="px-4 py-2 font-mono">{pt.code}</td>
              <td className="px-4 py-2">{pt.name_en}</td>
              <td className="px-4 py-2">{pt.is_active ? t('common.active') : t('common.inactive')}</td>
              <td className="px-4 py-2">
                {pt.is_active && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => deleteMutation.mutate(pt.id)}
                    isLoading={deleteMutation.isPending}
                  >
                    {t('common.deactivate')}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
