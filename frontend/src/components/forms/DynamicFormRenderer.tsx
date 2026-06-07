import { useMemo } from 'react';
import { useWatch, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';

import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import ProjectGeoMapSection from '@/components/forms/ProjectGeoMapSection';
import { useT } from '@/contexts/I18nContext';
import type { FormFieldDefinition } from '@/types/form';
import type { LocationNode } from '@/types/location';
import type { ProjectType } from '@/types/projectType';

interface Props {
  fields: FormFieldDefinition[];
  register: UseFormRegister<Record<string, unknown>>;
  control: Control<Record<string, unknown>>;
  setValue: UseFormSetValue<Record<string, unknown>>;
  errors: FieldErrors<Record<string, unknown>>;
  readOnlyKeys?: Set<string>;
  hiddenKeys?: Set<string>;
  projectTypes?: ProjectType[];
  locations?: LocationNode[];
  lockedLocationId?: number | null;
  lockedDistrict?: string | null;
  locale?: 'en' | 'bn';
  readOnlyAll?: boolean;
}

function labelFor(field: FormFieldDefinition, locale: 'en' | 'bn') {
  return locale === 'bn' && field.label_bn ? field.label_bn : field.label_en;
}

export default function DynamicFormRenderer({
  fields,
  register,
  control,
  setValue,
  errors,
  readOnlyKeys = new Set(),
  hiddenKeys = new Set(),
  projectTypes = [],
  locations = [],
  lockedLocationId,
  lockedDistrict,
  locale = 'en',
  readOnlyAll = false,
}: Props) {
  const { t } = useT();
  const selectedDistrict = useWatch({ control, name: 'district' }) as string | undefined;
  const sorted = useMemo(
    () => [...fields].sort((a, b) => a.display_order - b.display_order),
    [fields],
  );

  const hasCoords = sorted.some(
    (f) => f.field_key === 'latitude' || f.field_key === 'longitude' || f.field_key === 'map_coords',
  );
  const showDistrictInGeo = sorted.some((f) => f.field_key === 'district');
  const showUnionInGeo = sorted.some((f) => f.field_key === 'location_id');

  const sections = useMemo(() => {
    const map = new Map<string, FormFieldDefinition[]>();
    for (const f of sorted) {
      if (hiddenKeys.has(f.field_key)) continue;
      if (f.field_key === 'latitude' || f.field_key === 'longitude') continue;
      if (hasCoords && (f.field_key === 'district' || f.field_key === 'location_id')) continue;
      const sec = f.section ?? 'default';
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(f);
    }
    return map;
  }, [sorted, hiddenKeys, hasCoords]);

  function renderField(field: FormFieldDefinition) {
    const key = field.field_key;
    const label = labelFor(field, locale);
    const err = errors[key]?.message as string | undefined;
    const readOnly = readOnlyAll || readOnlyKeys.has(key);

    if (key === 'project_type_id') {
      return (
        <Select key={key} label={label} error={err} required={field.is_required} {...register(key)} disabled={readOnly}>
          <option value="">{t('common.select')}</option>
          {projectTypes.map((pt) => (
            <option key={pt.id} value={pt.id}>
              {locale === 'bn' && pt.name_bn ? pt.name_bn : pt.name_en}
            </option>
          ))}
        </Select>
      );
    }

    if (key === 'district') {
      const districts = Array.from(new Set(locations.map((l) => l.district))).sort();
      return (
        <Select
          key={key}
          label={label}
          error={err}
          required={field.is_required}
          {...register(key)}
          disabled={readOnly || !!lockedDistrict}
          defaultValue={lockedDistrict ?? ''}
        >
          <option value="">{t('common.select')}</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      );
    }

    if (key === 'location_id' || key === 'assigned_region') {
      let opts = lockedLocationId
        ? locations.filter((l) => l.id === lockedLocationId)
        : locations;
      const districtFilter = lockedDistrict ?? selectedDistrict;
      if (districtFilter && !lockedLocationId) {
        opts = opts.filter((l) => l.district === districtFilter);
      }
      return (
        <Select
          key={key}
          label={label}
          error={err}
          required={field.is_required}
          {...register(key)}
          disabled={readOnly || !!lockedLocationId}
        >
          <option value="">{t('common.select')}</option>
          {opts.map((l) => (
            <option key={l.id} value={l.id}>
              {l.district} → {l.upazila} → {l.union_name}
            </option>
          ))}
        </Select>
      );
    }

    if (field.field_type === 'textarea') {
      return (
        <div key={key} className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">
            {label}
            {field.is_required && <span className="text-red-500"> *</span>}
          </label>
          <textarea
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50"
            rows={3}
            readOnly={readOnly}
            required={field.is_required && !readOnly}
            {...register(key)}
          />
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
      );
    }

    if (field.field_type === 'select') {
      const options = field.options_json ?? [];
      return (
        <Select key={key} label={label} error={err} required={field.is_required} {...register(key)} disabled={readOnly}>
          <option value="">{t('common.select')}</option>
          {options.map((opt) => {
            const value = typeof opt === 'object' ? opt.value : opt;
            const optLabel = typeof opt === 'object' ? opt.label : opt;
            return (
              <option key={value} value={value}>
                {optLabel}
              </option>
            );
          })}
        </Select>
      );
    }

    if (field.field_type === 'number') {
      return (
        <Input
          key={key}
          type="number"
          step="any"
          label={label}
          error={err}
          required={field.is_required}
          readOnly={readOnly}
          {...register(key)}
        />
      );
    }

    if (field.field_type === 'date') {
      return (
        <Input
          key={key}
          type="date"
          label={label}
          error={err}
          required={field.is_required}
          readOnly={readOnly}
          {...register(key)}
        />
      );
    }

    return (
      <Input
        key={key}
        label={label}
        error={err}
        required={field.is_required}
        readOnly={readOnly}
        {...register(key)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(sections.entries()).map(([section, sectionFields]) => (
        <div key={section} className="space-y-4">
          {section !== 'default' && (
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {t(`section.${section}`) !== `section.${section}` ? t(`section.${section}`) : section}
            </h3>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {sectionFields.map(renderField)}
          </div>
        </div>
      ))}

      {hasCoords && !hiddenKeys.has('latitude') && (
        <ProjectGeoMapSection
          control={control}
          setValue={setValue}
          errors={errors}
          locations={locations}
          lockedLocationId={lockedLocationId}
          lockedDistrict={lockedDistrict}
          showDistrict={showDistrictInGeo}
          showUnion={showUnionInGeo}
          readOnly={readOnlyAll}
        />
      )}
    </div>
  );
}
