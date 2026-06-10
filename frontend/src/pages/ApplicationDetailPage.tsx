import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import { getFormSchema } from '@/api/formSettings';
import { listAllLocations } from '@/api/locations';
import { getProject } from '@/api/projects';
import { listProjectTypes } from '@/api/projectTypes';
import AssessmentScoreCard from '@/components/forms/AssessmentScoreCard';
import ProjectDetailsReadonly from '@/components/forms/ProjectDetailsReadonly';
import WorkflowStatusBadge from '@/components/forms/WorkflowStatusBadge';
import { useT } from '@/contexts/I18nContext';
import {
  filterChairmanSubmissionFields,
  filterPioAssessmentFields,
  hasPioAssessment,
  hasUnoDecision,
} from '@/lib/projectFormValues';

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, locale } = useT();

  const projectQuery = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(Number(id)),
    enabled: !!id,
  });

  const schemaQuery = useQuery({
    queryKey: ['form-schema', 'project_submission'],
    queryFn: () => getFormSchema('project_submission'),
  });

  const unoSchemaQuery = useQuery({
    queryKey: ['form-schema', 'uno_review'],
    queryFn: () => getFormSchema('uno_review'),
    enabled: !!projectQuery.data && hasUnoDecision(projectQuery.data),
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

  const project = projectQuery.data;

  const isLoading =
    projectQuery.isLoading || schemaQuery.isLoading || typesQuery.isLoading || locationsQuery.isLoading;

  if (isLoading) return <div className="p-6">{t('common.loading')}</div>;
  if (!project) return <div className="p-6">{t('projects.notFound')}</div>;

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{project.project_name}</h1>
          <p className="font-mono text-sm text-slate-500">{project.project_code}</p>
          {project.phase_number != null && project.phase_number > 1 && (
            <p className="mt-1 text-sm text-slate-500">
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

      {hasPioAssessment(project) && (
        <ProjectDetailsReadonly
          title={t('applications.pioAssessment')}
          fields={pioFields}
          project={project}
          locale={locale}
        />
      )}

      {hasUnoDecision(project) && unoSchemaQuery.data && (
        <ProjectDetailsReadonly
          title={t('applications.unoDecision')}
          fields={unoSchemaQuery.data.fields}
          project={project}
          locale={locale}
        />
      )}
    </div>
  );
}
