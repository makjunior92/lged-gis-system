import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { getFormSchema, updateFormSchema } from '@/api/formSettings';
import FormFieldBuilder from '@/components/forms/FormFieldBuilder';
import Button from '@/components/ui/Button';
import { useT } from '@/contexts/I18nContext';
import { extractErrorMessage } from '@/lib/api';
import type { FormFieldDefinition } from '@/types/form';

const SYSTEM_KEYS = new Set(['uno_decision', 'uno_remarks']);

export default function UnoReviewFieldsPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const [fields, setFields] = useState<FormFieldDefinition[]>([]);

  const query = useQuery({
    queryKey: ['form-schema', 'uno_review'],
    queryFn: () => getFormSchema('uno_review'),
  });

  useEffect(() => {
    if (query.data?.fields) setFields(query.data.fields);
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateFormSchema(
        'uno_review',
        fields.map((f) => ({
          ...f,
          visible_to_uno: true,
          visible_to_chairman: false,
        })),
      ),
    onSuccess: () => {
      toast.success(t('settings.saved'));
      qc.invalidateQueries({ queryKey: ['form-schema', 'uno_review'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  if (query.isLoading) return <div>{t('common.loading')}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">{t('settings.unoReview')}</h1>
        <p className="text-sm text-slate-500">{t('settings.unoReviewDesc')}</p>
      </div>
      <FormFieldBuilder
        fields={fields}
        onChange={setFields}
        systemFieldKeys={SYSTEM_KEYS}
        showUnoOptions
      />
      <Button onClick={() => saveMutation.mutate()} isLoading={saveMutation.isPending}>
        {t('common.save')}
      </Button>
    </div>
  );
}
