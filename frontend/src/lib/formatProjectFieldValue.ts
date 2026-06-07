import { formatBDT } from '@/lib/utils';
import { buildProjectFormValues } from '@/lib/projectFormValues';
import type { FormFieldDefinition } from '@/types/form';
import type { LocationNode } from '@/types/location';
import type { Project } from '@/types/project';
import type { ProjectType } from '@/types/projectType';

const BDT_FIELD_KEYS = new Set(['requested_budget', 'estimated_cost']);

function labelFor(field: FormFieldDefinition, locale: 'en' | 'bn'): string {
  return locale === 'bn' && field.label_bn ? field.label_bn : field.label_en;
}

function optionLabel(
  field: FormFieldDefinition,
  raw: unknown,
): string | null {
  if (raw == null || raw === '') return null;
  const value = String(raw);
  for (const opt of field.options_json ?? []) {
    const optValue = typeof opt === 'object' ? opt.value : opt;
    const optLabel = typeof opt === 'object' ? opt.label : opt;
    if (String(optValue) === value) return optLabel;
  }
  return value;
}

export function formatProjectFieldValue(
  field: FormFieldDefinition,
  project: Project,
  ctx: {
    projectTypes?: ProjectType[];
    locations?: LocationNode[];
    locale?: 'en' | 'bn';
  } = {},
): string {
  const values = buildProjectFormValues(project);
  const raw = values[field.field_key];
  const locale = ctx.locale ?? 'en';

  if (raw == null || raw === '') return '—';

  if (field.field_key === 'project_type_id') {
    const pt = project.project_type
      ?? ctx.projectTypes?.find((p) => p.id === Number(raw));
    if (!pt) return String(raw);
    return locale === 'bn' && pt.name_bn ? pt.name_bn : pt.name_en;
  }

  if (field.field_key === 'location_id' || field.field_key === 'assigned_region') {
    const loc = project.location
      ?? ctx.locations?.find((l) => l.id === Number(raw));
    if (!loc) return String(raw);
    return `${loc.upazila} → ${loc.union_name}`;
  }

  if (field.field_key === 'district') {
    return String(raw);
  }

  if (field.field_type === 'select' || field.field_key === 'uno_decision') {
    return optionLabel(field, raw) ?? String(raw);
  }

  if (BDT_FIELD_KEYS.has(field.field_key) || (field.field_type === 'number' && field.field_key.includes('budget'))) {
    return formatBDT(raw as number | string);
  }

  if (field.field_type === 'number') {
    const n = Number(raw);
    return Number.isNaN(n) ? String(raw) : String(n);
  }

  return String(raw);
}

export { labelFor };
