import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

import { getFormSchema } from '@/api/formSettings';
import { listAllLocations } from '@/api/locations';
import { createProject, listEligibleParents } from '@/api/projects';
import { listProjectTypes } from '@/api/projectTypes';
import DynamicFormRenderer from '@/components/forms/DynamicFormRenderer';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/contexts/I18nContext';
import { extractErrorMessage } from '@/lib/api';
import { roundGisCoord } from '@/lib/geoBounds';

function buildPayload(
  values: Record<string, unknown>,
  opts: { submit: boolean; isFollowUp: boolean; parentId: number | null; phaseNumber: number },
) {
  const custom_data: Record<string, unknown> = {};
  const systemKeys = new Set([
    'project_name', 'project_type_id', 'location_id', 'latitude', 'longitude',
  ]);
  for (const [k, v] of Object.entries(values)) {
    if (!systemKeys.has(k) && v !== '' && v != null) custom_data[k] = v;
  }
  const latitude = roundGisCoord(Number(values.latitude));
  const longitude = roundGisCoord(Number(values.longitude));
  return {
    project_name: String(values.project_name),
    project_type_id: Number(values.project_type_id),
    location_id: Number(values.location_id),
    latitude,
    longitude,
    custom_data,
    submit: opts.submit,
    is_follow_up_phase: opts.isFollowUp,
    parent_project_id: opts.isFollowUp && opts.parentId ? opts.parentId : undefined,
    phase_number: opts.isFollowUp ? opts.phaseNumber : undefined,
  };
}

export default function ChairmanApplicationPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { t, locale } = useT();
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [parentId, setParentId] = useState<number | null>(null);
  const [phaseNumber, setPhaseNumber] = useState(2);

  const schemaQuery = useQuery({
    queryKey: ['form-schema', 'project_submission'],
    queryFn: () => getFormSchema('project_submission'),
  });

  const typesQuery = useQuery({
    queryKey: ['project-types'],
    queryFn: () => listProjectTypes(true),
  });

  const locationsQuery = useQuery({
    queryKey: ['locations', 'all'],
    queryFn: listAllLocations,
  });

  const visibleFields = useMemo(() => {
    return (schemaQuery.data?.fields ?? []).filter((f) => f.visible_to_chairman);
  }, [schemaQuery.data]);

  const lockedDistrict = useMemo(() => {
    if (!user?.region) return null;
    return user.region.district;
  }, [user]);

  const assignedLocation = useMemo(() => {
    if (!user?.assigned_region || !locationsQuery.data) return null;
    return locationsQuery.data.find((l) => l.id === user.assigned_region) ?? null;
  }, [user?.assigned_region, locationsQuery.data]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Record<string, unknown>>({
    defaultValues: {
      district: lockedDistrict ?? '',
      location_id: user?.assigned_region ?? '',
      latitude: assignedLocation?.centroid_lat != null
        ? roundGisCoord(assignedLocation.centroid_lat)
        : 22.8456,
      longitude: assignedLocation?.centroid_lng != null
        ? roundGisCoord(assignedLocation.centroid_lng)
        : 91.1345,
    },
  });

  const locationId = Number(watch('location_id') || user?.assigned_region || 0);

  const parentsQuery = useQuery({
    queryKey: ['eligible-parents', locationId],
    queryFn: () => listEligibleParents(locationId),
    enabled: isFollowUp && locationId > 0,
  });

  useEffect(() => {
    if (!assignedLocation) return;
    if (assignedLocation.centroid_lat != null && assignedLocation.centroid_lng != null) {
      const lat = roundGisCoord(assignedLocation.centroid_lat);
      const lng = roundGisCoord(assignedLocation.centroid_lng);
      setValue('latitude', lat);
      setValue('longitude', lng);
    }
  }, [assignedLocation, setValue]);

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      createProject(buildPayload(values, { submit: false, isFollowUp, parentId, phaseNumber })),
    onSuccess: (p) => {
      toast.success(t('applications.savedDraft', { code: p.project_code }));
      qc.invalidateQueries({ queryKey: ['projects'] });
      navigate('/applications');
    },
    onError: (err) => toast.error(extractErrorMessage(err, t('applications.createFailed'))),
  });

  const submitMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      createProject(buildPayload(values, { submit: true, isFollowUp, parentId, phaseNumber })),
    onSuccess: (p) => {
      toast.success(t('applications.submitted', { code: p.project_code }));
      const veto = p.assessment?.breakdown?.find((b) => b.rule_type === 'veto' && !b.passed);
      if (veto || p.is_duplicate_flag) {
        toast.error(veto?.message ?? t('workflow.duplicateWarning'));
      } else if (p.assessment && !p.assessment.passed) {
        toast.error(t('assessment.lowScoreWarning', { score: p.assessment.total_score }));
      }
      qc.invalidateQueries({ queryKey: ['projects'] });
      navigate('/applications');
    },
    onError: (err) => toast.error(extractErrorMessage(err, t('applications.createFailed'))),
  });

  if (schemaQuery.isLoading) {
    return <div className="p-6 text-slate-500">{t('common.loading')}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        {t('common.back')}
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('applications.submitTitle')}</h1>
        <p className="text-sm text-slate-500">{t('applications.submitSubtitle')}</p>
      </div>

      <form className="space-y-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={isFollowUp}
              onChange={(e) => {
                setIsFollowUp(e.target.checked);
                if (!e.target.checked) setParentId(null);
              }}
            />
            {t('applications.followUpPhase')}
          </label>
          {isFollowUp && (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">{t('applications.parentProject')}</label>
                <select
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  value={parentId ?? ''}
                  onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">{t('applications.selectParent')}</option>
                  {(parentsQuery.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.project_code} — {p.project_name}
                      {p.phase_number ? ` (${t('applications.phase')} ${p.phase_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label={t('applications.phaseNumber')}
                type="number"
                min={2}
                max={99}
                value={String(phaseNumber)}
                onChange={(e) => setPhaseNumber(Number(e.target.value) || 2)}
              />
            </div>
          )}
        </div>

        <DynamicFormRenderer
          fields={visibleFields}
          register={register}
          control={control}
          setValue={setValue}
          errors={errors}
          projectTypes={typesQuery.data ?? []}
          locations={locationsQuery.data ?? []}
          lockedLocationId={user?.assigned_region ?? null}
          lockedDistrict={lockedDistrict}
          locale={locale}
        />

        <div className="flex gap-3 border-t border-slate-100 pt-4">
          <Button
            type="button"
            variant="secondary"
            isLoading={saveMutation.isPending || isSubmitting}
            onClick={handleSubmit((v) => saveMutation.mutate(v))}
          >
            {t('applications.saveDraft')}
          </Button>
          <Button
            type="button"
            isLoading={submitMutation.isPending || isSubmitting}
            onClick={handleSubmit((v) => submitMutation.mutate(v))}
          >
            {t('applications.submitApplication')}
          </Button>
        </div>
      </form>
    </div>
  );
}
