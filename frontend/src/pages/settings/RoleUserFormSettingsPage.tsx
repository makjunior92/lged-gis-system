import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { getFormSchema, updateFormSchema } from '@/api/formSettings';
import FormFieldBuilder from '@/components/forms/FormFieldBuilder';
import Button from '@/components/ui/Button';
import { useT } from '@/contexts/I18nContext';
import { extractErrorMessage } from '@/lib/api';
import type { FormFieldDefinition, FormSchemaKey } from '@/types/form';

interface Props {
  schemaKey: FormSchemaKey;
  systemFieldKeys: Set<string>;
  titleKey: string;
  descKey: string;
}

export default function RoleUserFormSettingsPage({
  schemaKey,
  systemFieldKeys,
  titleKey,
  descKey,
}: Props) {
  const { t } = useT();
  const qc = useQueryClient();
  const [fields, setFields] = useState<FormFieldDefinition[]>([]);

  const query = useQuery({
    queryKey: ['form-schema', schemaKey],
    queryFn: () => getFormSchema(schemaKey),
  });

  useEffect(() => {
    if (query.data?.fields) setFields(query.data.fields);
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateFormSchema(schemaKey, fields),
    onSuccess: () => {
      toast.success(t('settings.saved'));
      qc.invalidateQueries({ queryKey: ['form-schema', schemaKey] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  if (query.isLoading) return <div>{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{t(titleKey)}</h1>
        <p className="text-sm text-slate-500">{t(descKey)}</p>
        {schemaKey === 'chairman_user_create' && (
          <p className="mt-1 text-xs text-slate-400">{t('users.chairmanIdHint')}</p>
        )}
        {(schemaKey === 'pio_user_create' || schemaKey === 'uno_user_create') && (
          <p className="mt-1 text-xs text-slate-400">{t('users.govEmployeeIdHint')}</p>
        )}
      </div>
      <FormFieldBuilder fields={fields} onChange={setFields} systemFieldKeys={systemFieldKeys} />
      <Button onClick={() => saveMutation.mutate()} isLoading={saveMutation.isPending}>
        {t('common.save')}
      </Button>
    </div>
  );
}
