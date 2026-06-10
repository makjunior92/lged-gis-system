import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import {
  getAssessmentConfig,
  listAssessmentRules,
  updateAssessmentConfig,
  updateAssessmentRule,
} from '@/api/assessmentSettings';
import { TableScroll } from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useT } from '@/contexts/I18nContext';
import { extractErrorMessage } from '@/lib/api';
import type { AssessmentRule } from '@/types/assessment';

const PARAM_HINTS: Record<string, string> = {
  duplicate_nearby: '{"radius_meters": 50}',
  geo_outside_union: '{}',
  budget_over_cap: '{"max_cost": 50000000}',
  budget_vs_median: '{"max_ratio": 2.0}',
  pending_same_type: '{"max_pending": 3}',
  description_complete: '{"required_fields": ["current_situation", "development_status"]}',
};

function RuleParamsEditor({
  rule,
  onSave,
  isSaving,
}: {
  rule: AssessmentRule;
  onSave: (params: Record<string, unknown>) => void;
  isSaving: boolean;
}) {
  const { t } = useT();
  const [text, setText] = useState(JSON.stringify(rule.params ?? {}, null, 0));

  return (
    <div className="flex flex-col gap-1">
      <textarea
        className="min-h-[48px] rounded border border-slate-200 px-2 py-1 font-mono text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={PARAM_HINTS[rule.rule_key] ?? '{}'}
      />
      <Button
        size="sm"
        variant="outline"
        isLoading={isSaving}
        onClick={() => {
          try {
            onSave(JSON.parse(text) as Record<string, unknown>);
          } catch {
            toast.error(t('assessment.invalidJson'));
          }
        }}
      >
        {t('assessment.saveParams')}
      </Button>
    </div>
  );
}

export default function AssessmentRulesPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const [threshold, setThreshold] = useState('80');

  const configQuery = useQuery({
    queryKey: ['assessment-config'],
    queryFn: getAssessmentConfig,
  });

  const rulesQuery = useQuery({
    queryKey: ['assessment-rules'],
    queryFn: listAssessmentRules,
  });

  const weightedSum = useMemo(() => {
    return (rulesQuery.data ?? [])
      .filter((r) => r.is_active && r.rule_type === 'weighted')
      .reduce((sum, r) => sum + (r.weight ?? 0), 0);
  }, [rulesQuery.data]);

  const configMutation = useMutation({
    mutationFn: () => updateAssessmentConfig(Number(threshold)),
    onSuccess: () => {
      toast.success(t('settings.saved'));
      qc.invalidateQueries({ queryKey: ['assessment-config'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const ruleMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof updateAssessmentRule>[1] }) =>
      updateAssessmentRule(id, payload),
    onSuccess: () => {
      toast.success(t('settings.saved'));
      qc.invalidateQueries({ queryKey: ['assessment-rules'] });
      qc.invalidateQueries({ queryKey: ['assessment-config'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  useEffect(() => {
    if (configQuery.data) {
      setThreshold(String(configQuery.data.pass_threshold));
    }
  }, [configQuery.data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{t('settings.assessmentRules')}</h1>
        <p className="text-sm text-slate-500">{t('settings.assessmentRulesDesc')}</p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-white p-4">
        <Input
          label={t('assessment.passThreshold')}
          type="number"
          min={0}
          max={100}
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
        />
        <Button onClick={() => configMutation.mutate()} isLoading={configMutation.isPending}>
          {t('common.save')}
        </Button>
        <p className="text-sm text-slate-500">
          {t('assessment.weightSum')}: <strong className={weightedSum === 100 ? 'text-emerald-600' : 'text-red-600'}>{weightedSum}</strong> / 100
        </p>
      </div>

      <TableScroll>
      <table className="min-w-full divide-y divide-slate-200 rounded-lg border bg-white text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left">{t('settings.labelEn')}</th>
            <th className="px-4 py-2 text-left">{t('assessment.ruleType')}</th>
            <th className="px-4 py-2 text-left">{t('assessment.weight')}</th>
            <th className="px-4 py-2 text-left">{t('assessment.params')}</th>
            <th className="px-4 py-2 text-left">{t('common.status')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(rulesQuery.data ?? []).map((rule) => (
            <tr key={rule.id}>
              <td className="px-4 py-2">
                <p className="font-medium">{rule.display_name}</p>
                <p className="font-mono text-xs text-slate-400">{rule.rule_key}</p>
              </td>
              <td className="px-4 py-2 capitalize">{rule.rule_type}</td>
              <td className="px-4 py-2">
                {rule.rule_type === 'weighted' ? (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="w-16 rounded border px-2 py-1"
                    defaultValue={rule.weight ?? 0}
                    onBlur={(e) =>
                      ruleMutation.mutate({
                        id: rule.id,
                        payload: { weight: Number(e.target.value) },
                      })
                    }
                  />
                ) : (
                  '—'
                )}
              </td>
              <td className="px-4 py-2 max-w-xs">
                <RuleParamsEditor
                  rule={rule}
                  isSaving={ruleMutation.isPending}
                  onSave={(params) => ruleMutation.mutate({ id: rule.id, payload: { params } })}
                />
              </td>
              <td className="px-4 py-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rule.is_active}
                    onChange={(e) =>
                      ruleMutation.mutate({
                        id: rule.id,
                        payload: { is_active: e.target.checked },
                      })
                    }
                  />
                  {rule.is_active ? t('common.active') : t('common.inactive')}
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableScroll>
    </div>
  );
}
