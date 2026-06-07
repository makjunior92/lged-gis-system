import type { Project } from '@/types/project';

/** Flatten project + system columns into react-hook-form default values. */
export function buildProjectFormValues(project: Project): Record<string, unknown> {
  return {
    project_name: project.project_name,
    project_type_id: project.project_type_id,
    location_id: project.location_id,
    district: project.location?.district ?? '',
    latitude: Number(project.latitude),
    longitude: Number(project.longitude),
    estimated_cost: project.estimated_cost ?? '',
    current_situation: project.current_situation ?? '',
    development_status: project.development_status ?? '',
    pio_remarks: project.pio_remarks ?? '',
    uno_remarks: project.uno_remarks ?? '',
    uno_decision: project.uno_decision ?? '',
    ...project.custom_data,
  };
}

const PIO_ASSESSMENT_KEYS = new Set([
  'estimated_cost',
  'current_situation',
  'development_status',
  'pio_remarks',
]);

export function filterChairmanSubmissionFields<T extends { visible_to_chairman: boolean }>(
  fields: T[],
): T[] {
  return fields.filter((f) => f.visible_to_chairman);
}

export function filterPioAssessmentFields<T extends { section?: string | null; field_key: string }>(
  fields: T[],
): T[] {
  return fields.filter((f) => f.section === 'pio' || PIO_ASSESSMENT_KEYS.has(f.field_key));
}

export function hasPioAssessment(project: Project): boolean {
  if (['Forwarded to UNO', 'Approved', 'Rejected'].includes(project.workflow_status)) {
    return true;
  }
  return !!(
    project.estimated_cost
    || project.current_situation
    || project.development_status
    || project.pio_remarks
  );
}

export function hasUnoDecision(project: Project): boolean {
  return !!(
    project.uno_decision
    || project.workflow_status === 'Approved'
    || project.workflow_status === 'Rejected'
  );
}
