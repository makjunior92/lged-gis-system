import { api } from '@/lib/api';
import type { ProjectType, ProjectTypeCreatePayload, ProjectTypeUpdatePayload } from '@/types/projectType';

export async function listProjectTypes(activeOnly = true): Promise<ProjectType[]> {
  const res = await api.get<ProjectType[]>('/settings/project-types/', {
    params: { active_only: activeOnly },
  });
  return res.data;
}

export async function createProjectType(payload: ProjectTypeCreatePayload): Promise<ProjectType> {
  const res = await api.post<ProjectType>('/settings/project-types/', payload);
  return res.data;
}

export async function updateProjectType(
  id: number,
  payload: ProjectTypeUpdatePayload,
): Promise<ProjectType> {
  const res = await api.patch<ProjectType>(`/settings/project-types/${id}`, payload);
  return res.data;
}

export async function deleteProjectType(id: number): Promise<void> {
  await api.delete(`/settings/project-types/${id}`);
}
