import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

import { getFormSchema } from '@/api/formSettings';
import { listAllLocations } from '@/api/locations';
import {
  getProject,
  pioForwardProject,
  pioRecheckAssessment,
  updateProject,
} from '@/api/projects';
import { listProjectTypes } from '@/api/projectTypes';
import AssessmentScoreCard from '@/components/forms/AssessmentScoreCard';
import DynamicFormRenderer from '@/components/forms/DynamicFormRenderer';
import ProjectDetailsReadonly from '@/components/forms/ProjectDetailsReadonly';
import WorkflowStatusBadge from '@/components/forms/WorkflowStatusBadge';
import Button from '@/components/ui/Button';
import { useT } from '@/contexts/I18nContext';
import { extractErrorMessage } from '@/lib/api';
import { buildProjectFormValues, filterChairmanSubmissionFields } from '@/lib/projectFormValues';

export default function PioProjectReviewPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t, locale } = useT();

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Number.isFinite(projectId),
  });

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

  const submissionFields = useMemo(
    () => filterChairmanSubmissionFields(schemaQuery.data?.fields ?? []),
    [schemaQuery.data],
  );

  const pioFields = useMemo(() => {
    return (schemaQuery.data?.fields ?? []).filter(
      (f) => f.editable_by_pio || ['estimated_cost', 'current_situation', 'development_status', 'pio_remarks'].includes(f.field_key),
    );
  }, [schemaQuery.data]);

  const readOnlyKeys = useMemo(() => {
    const editable = new Set(projectQuery.data?.editable_fields ?? []);
    const all = new Set(pioFields.map((f) => f.field_key));
    return new Set([...all].filter((k) => !editable.has(k)));
  }, [pioFields, projectQuery.data]);

  const { register, handleSubmit, control, setValue, reset, getValues, formState: { errors } } = useForm<Record<string, unknown>>();

  const project = projectQuery.data;

  useEffect(() => {
    if (!project) return;
    reset(buildProjectFormValues(project));
  }, [project, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, unknown>) => {
      const payload: Record<string, unknown> = {};
      for (const key of project?.editable_fields ?? []) {
        if (values[key] !== undefined) payload[key] = values[key];
      }
      return updateProject(projectId, payload as Parameters<typeof updateProject>[1]);
    },
    onSuccess: () => {
      toast.success(t('common.saved'));
      qc.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const forwardMutation = useMutation({
    mutationFn: (remarks?: string) => pioForwardProject(projectId, remarks),
    onSuccess: () => {
      toast.success(t('pio.forwarded'));
      qc.invalidateQueries({ queryKey: ['projects'] });
      navigate('/pio/review');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const recheckMutation = useMutation({
    mutationFn: () => pioRecheckAssessment(projectId),
    onSuccess: () => {
      toast.success(t('pio.rechecked'));
      qc.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const isLoading =
    projectQuery.isLoading || schemaQuery.isLoading || typesQuery.isLoading || locationsQuery.isLoading;

  if (isLoading) return <div className="p-6">{t('common.loading')}</div>;
  if (!project) return <div className="p-6">{t('projects.notFound')}</div>;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-6">
      <button type="button" onClick={() => navigate('/pio/review')} className="inline-flex items-center gap-1 text-sm text-slate-600">
        <ArrowLeft size={16} />{t('common.back')}
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.project_name}</h1>
          <p className="font-mono text-sm text-slate-500">{project.project_code}</p>
          {project.phase_number && project.phase_number > 1 && (
            <p className="text-sm text-slate-500">
              {t('applications.phase')} {project.phase_number}
              {project.parent_project_id ? ` · ${t('applications.linkedToParent')}` : ''}
            </p>
          )}
        </div>
        <WorkflowStatusBadge status={project.workflow_status} />
      </div>

      <AssessmentScoreCard project={project} />

      <ProjectDetailsReadonly
        title={t('applications.submittedDetails')}
        fields={submissionFields}
        project={project}
        locations={locationsQuery.data ?? []}
        projectTypes={typesQuery.data ?? []}
        locale={locale}
      />

      <form className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
        <h2 className="text-lg font-semibold text-slate-900">{t('pio.editSection')}</h2>
        <DynamicFormRenderer
          fields={pioFields}
          register={register}
          control={control}
          setValue={setValue}
          errors={errors}
          readOnlyKeys={readOnlyKeys}
          hiddenKeys={new Set(['project_name', 'project_type_id', 'location_id', 'district', 'latitude', 'longitude'])}
          locale={locale}
        />
        <Button type="submit" variant="secondary" isLoading={saveMutation.isPending}>{t('common.save')}</Button>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <Button type="button" variant="outline" onClick={() => recheckMutation.mutate()} isLoading={recheckMutation.isPending}>
          {t('pio.recheckAssessment')}
        </Button>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => forwardMutation.mutate(String(getValues('pio_remarks') ?? ''))}
          isLoading={forwardMutation.isPending}
        >
          {t('pio.forwardToUno')}
        </Button>
      </div>
    </div>
  );
}
