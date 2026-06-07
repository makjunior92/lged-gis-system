export type AssessmentRuleType = 'veto' | 'weighted';

export type AssessmentRuleKey =
  | 'duplicate_nearby'
  | 'geo_outside_union'
  | 'budget_over_cap'
  | 'budget_vs_median'
  | 'pending_same_type'
  | 'description_complete';

export interface AssessmentConfig {
  pass_threshold: number;
  version: number;
  updated_at: string;
}

export interface AssessmentRule {
  id: number;
  rule_key: AssessmentRuleKey;
  display_name: string;
  rule_type: AssessmentRuleType;
  weight: number | null;
  params: Record<string, unknown>;
  failure_message: string;
  is_active: boolean;
  sort_order: number;
}

export interface AssessmentBreakdownItem {
  rule_key: string;
  rule_type: AssessmentRuleType;
  display_name?: string;
  weight?: number | null;
  earned: number;
  max: number;
  passed: boolean;
  message: string;
  matches?: Array<{
    project_id: number;
    project_code: string;
    project_name: string;
    reason: string;
  }>;
}

export interface ProjectAssessment {
  total_score: number;
  passed: boolean;
  pass_threshold: number;
  breakdown: AssessmentBreakdownItem[];
  evaluated_at?: string | null;
}

export interface EligibleParent {
  id: number;
  project_code: string;
  project_name: string;
  phase_number?: number | null;
  workflow_status: string;
}
