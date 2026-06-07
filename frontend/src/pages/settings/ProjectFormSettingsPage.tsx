import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { getFormSchema, updateFormSchema } from '@/api/formSettings';
import { listAllLocations } from '@/api/locations';
import FormFieldBuilder from '@/components/forms/FormFieldBuilder';
import ProjectGeoMapSection from '@/components/forms/ProjectGeoMapSection';
import Button from '@/components/ui/Button';
import { useT } from '@/contexts/I18nContext';
import { extractErrorMessage } from '@/lib/api';
import type { FormFieldDefinition } from '@/types/form';

const SYSTEM_KEYS = new Set([
  'project_name', 'project_type_id', 'district', 'location_id', 'latitude', 'longitude',
]);

export default function ProjectFormSettingsPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const [fields, setFields] = useState<FormFieldDefinition[]>([]);

  const query = useQuery({
    queryKey: ['form-schema', 'project_submission'],
    queryFn: () => getFormSchema('project_submission'),
  });

  const locationsQuery = useQuery({
    queryKey: ['locations', 'all'],
    queryFn: listAllLocations,
  });

  const {
    control,
    setValue,
    formState: { errors },
  } = useForm<Record<string, unknown>>({
    defaultValues: {
      district: 'Feni',
      location_id: '',
      latitude: 22.8456,
      longitude: 91.1345,
    },
  });

  useEffect(() => {
    if (query.data?.fields) setFields(query.data.fields);
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateFormSchema('project_submission', fields),
    onSuccess: () => {
      toast.success(t('settings.saved'));
      qc.invalidateQueries({ queryKey: ['form-schema', 'project_submission'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const hasGeoFields = fields.some(
    (f) => f.field_key === 'latitude' || f.field_key === 'longitude',
  );

  if (query.isLoading) return <div>{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t('settings.projectForm')}</h1>
        <p className="text-sm text-slate-500">{t('settings.projectFormDesc')}</p>
      </div>

      <FormFieldBuilder fields={fields} onChange={setFields} systemFieldKeys={SYSTEM_KEYS} />

      <Button onClick={() => saveMutation.mutate()} isLoading={saveMutation.isPending}>
        {t('common.save')}
      </Button>

      {hasGeoFields && (
        <div className="rounded-lg border border-brand-200 bg-white p-4 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-slate-800">{t('settings.mapPreview')}</h2>
          <p className="mb-4 text-sm text-slate-500">{t('settings.mapPreviewDesc')}</p>
          <ProjectGeoMapSection
            control={control}
            setValue={setValue}
            errors={errors}
            locations={locationsQuery.data ?? []}
            showDistrict={fields.some((f) => f.field_key === 'district')}
            showUnion={fields.some((f) => f.field_key === 'location_id')}
          />
        </div>
      )}
    </div>
  );
}
