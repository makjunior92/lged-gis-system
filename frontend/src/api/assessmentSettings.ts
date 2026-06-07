import { api } from '@/lib/api';
import type { AssessmentConfig, AssessmentRule, AssessmentRuleKey } from '@/types/assessment';

export async function getAssessmentConfig(): Promise<AssessmentConfig> {
  const res = await api.get<AssessmentConfig>('/settings/assessment/config');
  return res.data;
}

export async function updateAssessmentConfig(pass_threshold: number): Promise<AssessmentConfig> {
  const res = await api.put<AssessmentConfig>('/settings/assessment/config', { pass_threshold });
  return res.data;
}

export async function listAssessmentRules(): Promise<AssessmentRule[]> {
  const res = await api.get<AssessmentRule[]>('/settings/assessment/rules');
  return res.data;
}

export async function updateAssessmentRule(
  id: number,
  payload: Partial<{
    display_name: string;
    weight: number | null;
    params: Record<string, unknown>;
    failure_message: string;
    is_active: boolean;
    sort_order: number;
  }>,
): Promise<AssessmentRule> {
  const res = await api.patch<AssessmentRule>(`/settings/assessment/rules/${id}`, payload);
  return res.data;
}

export async function createAssessmentRule(payload: {
  rule_key: AssessmentRuleKey;
  display_name: string;
  rule_type: 'veto' | 'weighted';
  weight?: number | null;
  params?: Record<string, unknown>;
  failure_message: string;
  is_active?: boolean;
  sort_order?: number;
}): Promise<AssessmentRule> {
  const res = await api.post<AssessmentRule>('/settings/assessment/rules', payload);
  return res.data;
}
