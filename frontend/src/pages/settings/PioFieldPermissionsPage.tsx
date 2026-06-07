import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { getFormSchema, updateFieldPermissions } from '@/api/formSettings';
import Button from '@/components/ui/Button';
import { useT } from '@/contexts/I18nContext';
import { extractErrorMessage } from '@/lib/api';
import type { FieldPermissionUpdate } from '@/types/form';

export default function PioFieldPermissionsPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const [permissions, setPermissions] = useState<FieldPermissionUpdate[]>([]);

  const query = useQuery({
    queryKey: ['form-schema', 'project_submission'],
    queryFn: () => getFormSchema('project_submission'),
  });

  useEffect(() => {
    if (query.data?.fields) {
      setPermissions(
        query.data.fields.map((f) => ({
          field_key: f.field_key,
          editable_by_pio: f.editable_by_pio,
          editable_by_uno: f.editable_by_uno,
          visible_to_uno: f.visible_to_uno,
        })),
      );
    }
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateFieldPermissions('project_submission', permissions),
    onSuccess: () => {
      toast.success(t('settings.saved'));
      qc.invalidateQueries({ queryKey: ['form-schema', 'project_submission'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  function togglePio(index: number) {
    setPermissions((prev) =>
      prev.map((p, i) => (i === index ? { ...p, editable_by_pio: !p.editable_by_pio } : p)),
    );
  }


  if (query.isLoading) return <div>{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{t('settings.pioPermissions')}</h1>
        <p className="text-sm text-slate-500">{t('settings.pioPermissionsDesc')}</p>
      </div>

      <table className="min-w-full divide-y divide-slate-200 rounded-lg border bg-white text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left">{t('settings.fieldKey')}</th>
            <th className="px-4 py-2 text-left">{t('settings.pioEditable')}</th>
            <th className="px-4 py-2 text-left">{t('settings.readOnlyPio')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {permissions.map((p, index) => {
            const field = query.data?.fields.find((f) => f.field_key === p.field_key);
            return (
              <tr key={p.field_key}>
                <td className="px-4 py-2">{field?.label_en ?? p.field_key}</td>
                <td className="px-4 py-2">
                  <input type="checkbox" checked={p.editable_by_pio} onChange={() => togglePio(index)} />
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {p.editable_by_pio ? t('settings.editable') : t('settings.readOnly')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Button onClick={() => saveMutation.mutate()} isLoading={saveMutation.isPending}>
        {t('common.save')}
      </Button>
    </div>
  );
}
