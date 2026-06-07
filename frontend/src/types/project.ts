import type { ProjectAssessment } from '@/types/assessment';
import type { ProjectType } from '@/types/projectType';

export const WORKFLOW_STATUSES = [
  'Draft',
  'Submitted',
  'Under PIO Review',
  'Forwarded to UNO',
  'Approved',
  'Rejected',
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export interface LocationSummary {
  id: number;
  division: string;
  district: string;
  upazila: string;
  union_name: string;
}

export interface DuplicateMatch {
  project_id: number;
  project_code: string;
  project_name: string;
  reason: string;
}

export interface Project {
  id: number;
  project_code: string;
  project_name: string;
  project_type_id: number;
  project_type?: ProjectType | null;
  location_id: number;
  location?: LocationSummary | null;
  latitude: string | number;
  longitude: string | number;
  workflow_status: WorkflowStatus;
  custom_data: Record<string, unknown>;
  estimated_cost?: string | number | null;
  current_situation?: string | null;
  development_status?: string | null;
  pio_remarks?: string | null;
  uno_remarks?: string | null;
  uno_decision?: string | null;
  is_duplicate_flag: boolean;
  duplicate_reason?: string | null;
  is_impractical_budget_flag: boolean;
  impractical_budget_reason?: string | null;
  parent_project_id?: number | null;
  phase_number?: number | null;
  project_group_id?: string | null;
  created_by?: number | null;
  created_at: string;
  editable_fields: string[];
  duplicate_matches: DuplicateMatch[];
  assessment?: ProjectAssessment | null;
}

export interface ProjectCreatePayload {
  project_name: string;
  project_type_id: number;
  location_id: number;
  latitude: number;
  longitude: number;
  custom_data?: Record<string, unknown>;
  submit?: boolean;
  is_follow_up_phase?: boolean;
  parent_project_id?: number;
  phase_number?: number;
}

export interface ProjectUpdatePayload {
  project_name?: string;
  project_type_id?: number;
  location_id?: number;
  latitude?: number;
  longitude?: number;
  custom_data?: Record<string, unknown>;
  estimated_cost?: number;
  current_situation?: string;
  development_status?: string;
  pio_remarks?: string;
  uno_remarks?: string;
  uno_decision?: string;
}

export interface ProjectListFilters {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string;
}

export interface WorkflowEvent {
  id: number;
  project_id: number;
  actor_id?: number | null;
  from_status?: string | null;
  to_status?: string | null;
  action: string;
  remarks?: string | null;
  field_changes?: Record<string, unknown> | null;
  created_at: string;
}
