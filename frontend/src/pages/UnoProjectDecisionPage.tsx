import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

import { getFormSchema } from '@/api/formSettings';
import { listAllLocations } from '@/api/locations';
import { getProject, unoDecideProject } from '@/api/projects';
import { listProjectTypes } from '@/api/projectTypes';
import AssessmentScoreCard from '@/components/forms/AssessmentScoreCard';
import DynamicFormRenderer from '@/components/forms/DynamicFormRenderer';
import ProjectDetailsReadonly from '@/components/forms/ProjectDetailsReadonly';
import WorkflowStatusBadge from '@/components/forms/WorkflowStatusBadge';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useT } from '@/contexts/I18nContext';
import { extractErrorMessage } from '@/lib/api';
import {
  buildProjectFormValues,
  filterChairmanSubmissionFields,
  filterPioAssessmentFields,
  hasPioAssessment,
} from '@/lib/projectFormValues';

const UNO_SYSTEM_KEYS = new Set(['uno_decision', 'uno_remarks']);
const HIDDEN_UNO_KEYS = new Set(['uno_decision']);

type PendingDecision = {
  decision: 'approved' | 'rejected';
  values: Record<string, unknown>;
};

export default function UnoProjectDecisionPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t, locale } = useT();
  const [pending, setPending] = useState<PendingDecision | null>(null);

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
    enabled: Number.isFinite(projectId),
  });

  const schemaQuery = useQuery({
    queryKey: ['form-schema', 'project_submission'],
    queryFn: () => getFormSchema('project_submission'),
  });

  const unoSchemaQuery = useQuery({
    queryKey: ['form-schema', 'uno_review'],
    queryFn: () => getFormSchema('uno_review'),
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

  const pioFields = useMemo(
    () => filterPioAssessmentFields(schemaQuery.data?.fields ?? []),
    [schemaQuery.data],
  );

  const unoFields = useMemo(() => unoSchemaQuery.data?.fields ?? [], [unoSchemaQuery.data]);

  const { register, handleSubmit, control, setValue, reset, formState: { errors } } = useForm<Record<string, unknown>>({
    defaultValues: { uno_remarks: '' },
  });

  const project = projectQuery.data;
  const canDecide = project?.workflow_status === 'Forwarded to UNO';

  useEffect(() => {
    if (!project) return;
    reset(buildProjectFormValues(project));
  }, [project, reset]);

  function buildPayload(values: Record<string, unknown>, decision: 'approved' | 'rejected') {
    const custom_data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (!UNO_SYSTEM_KEYS.has(k) && v !== '' && v != null) custom_data[k] = v;
    }
    return {
      decision,
      remarks: String(values.uno_remarks ?? '').trim(),
      custom_data,
    };
  }

  const decideMutation = useMutation({
    mutationFn: ({ decision, values }: PendingDecision) => {
      const p = buildPayload(values, decision);
      return unoDecideProject(projectId, p.decision, p.remarks, p.custom_data);
    },
    onSuccess: (_data, { decision }) => {
      toast.success(decision === 'approved' ? t('uno.approved') : t('uno.rejected'));
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      setPending(null);
      navigate('/uno/approvals');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  function requestDecision(decision: 'approved' | 'rejected') {
    handleSubmit((values) => {
      const remarks = String(values.uno_remarks ?? '').trim();
      if (!remarks) {
        toast.error(t('uno.remarksRequired'));
        return;
      }
      setPending({ decision, values });
    })();
  }

  function handleConfirm() {
    if (!pending) return;
    decideMutation.mutate(pending);
  }

  const isLoading =
    projectQuery.isLoading
    || schemaQuery.isLoading
    || unoSchemaQuery.isLoading
    || typesQuery.isLoading
    || locationsQuery.isLoading;

  if (isLoading) return <div className="p-6">{t('common.loading')}</div>;
  if (!project) return <div className="p-6">{t('projects.notFound')}</div>;

  const isApprovePending = pending?.decision === 'approved';

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-6">
      <button type="button" onClick={() => navigate('/uno/approvals')} className="inline-flex items-center gap-1 text-sm text-slate-600">
        <ArrowLeft size={16} />{t('common.back')}
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.project_name}</h1>
          <p className="font-mono text-sm text-slate-500">{project.project_code}</p>
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

      {hasPioAssessment(project) && (
        <ProjectDetailsReadonly
          title={t('applications.pioAssessment')}
          fields={pioFields}
          project={project}
          locale={locale}
        />
      )}

      {canDecide ? (
        <form className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={(e) => e.preventDefault()}>
          <h2 className="text-lg font-semibold text-slate-900">{t('uno.decisionSection')}</h2>
          <DynamicFormRenderer
            fields={unoFields}
            register={register}
            control={control}
            setValue={setValue}
            errors={errors}
            locale={locale}
            hiddenKeys={HIDDEN_UNO_KEYS}
          />
          <div className="flex gap-3 border-t border-slate-100 pt-4">
            <Button
              type="button"
              onClick={() => requestDecision('approved')}
              isLoading={decideMutation.isPending && isApprovePending}
              disabled={decideMutation.isPending}
            >
              {t('uno.approveFunding')}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => requestDecision('rejected')}
              isLoading={decideMutation.isPending && !isApprovePending}
              disabled={decideMutation.isPending}
            >
              {t('uno.rejectFunding')}
            </Button>
          </div>
        </form>
      ) : (
        <ProjectDetailsReadonly
          title={t('uno.decisionSection')}
          fields={unoFields}
          project={project}
          locale={locale}
        />
      )}

      {pending && (
        <ConfirmDialog
          open
          title={isApprovePending ? t('uno.confirmApproveTitle') : t('uno.confirmRejectTitle')}
          message={isApprovePending ? t('uno.confirmApproveMessage') : t('uno.confirmRejectMessage')}
          confirmLabel={isApprovePending ? t('uno.confirmApprove') : t('uno.confirmReject')}
          variant={isApprovePending ? 'default' : 'danger'}
          isLoading={decideMutation.isPending}
          onConfirm={handleConfirm}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
