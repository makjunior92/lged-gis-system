import { api } from '@/lib/api';
import type { Paginated } from '@/types/common';
import type { EligibleParent } from '@/types/assessment';
import type {
  Project,
  ProjectCreatePayload,
  ProjectListFilters,
  ProjectUpdatePayload,
  WorkflowEvent,
} from '@/types/project';

export async function listProjects(filters: ProjectListFilters = {}): Promise<Paginated<Project>> {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') params[k] = v as string | number;
  }
  const res = await api.get<Paginated<Project>>('/projects/', { params });
  return res.data;
}

export async function createProject(payload: ProjectCreatePayload): Promise<Project> {
  const res = await api.post<Project>('/projects/', payload);
  return res.data;
}

export async function getProject(id: number): Promise<Project> {
  const res = await api.get<Project>(`/projects/${id}`);
  return res.data;
}

export async function updateProject(id: number, payload: ProjectUpdatePayload): Promise<Project> {
  const res = await api.patch<Project>(`/projects/${id}`, payload);
  return res.data;
}

export async function submitProject(id: number): Promise<Project> {
  const res = await api.post<Project>(`/projects/${id}/submit`);
  return res.data;
}

export async function pioForwardProject(id: number, remarks?: string): Promise<Project> {
  const res = await api.post<Project>(`/projects/${id}/pio/forward`, { remarks });
  return res.data;
}

export async function pioFlagProject(
  id: number,
  payload: {
    duplicate?: boolean;
    duplicate_reason?: string;
    impractical_budget?: boolean;
    impractical_budget_reason?: string;
  },
): Promise<Project> {
  const res = await api.post<Project>(`/projects/${id}/pio/flag`, payload);
  return res.data;
}

export async function listEligibleParents(
  locationId: number,
  excludeProjectId?: number,
): Promise<EligibleParent[]> {
  const params: Record<string, number> = { location_id: locationId };
  if (excludeProjectId) params.exclude_project_id = excludeProjectId;
  const res = await api.get<EligibleParent[]>('/projects/eligible-parents', { params });
  return res.data;
}

export async function pioRecheckAssessment(id: number): Promise<Project> {
  const res = await api.post<Project>(`/projects/${id}/pio/recheck-assessment`);
  return res.data;
}

export async function unoDecideProject(
  id: number,
  decision: 'approved' | 'rejected',
  remarks?: string,
  custom_data?: Record<string, unknown>,
): Promise<Project> {
  const res = await api.post<Project>(`/projects/${id}/uno/decide`, {
    decision,
    remarks,
    custom_data,
  });
  return res.data;
}

export async function listWorkflowEvents(projectId: number): Promise<WorkflowEvent[]> {
  const res = await api.get<WorkflowEvent[]>(`/projects/${projectId}/workflow-events`);
  return res.data;
}
