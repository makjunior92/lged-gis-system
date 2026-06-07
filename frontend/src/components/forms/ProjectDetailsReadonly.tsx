import { useMemo, type ReactNode } from 'react';

import LocationPicker from '@/components/LocationPicker';
import { useT } from '@/contexts/I18nContext';
import { formatProjectFieldValue, labelFor } from '@/lib/formatProjectFieldValue';
import type { FormFieldDefinition } from '@/types/form';
import type { LocationNode } from '@/types/location';
import type { Project } from '@/types/project';
import type { ProjectType } from '@/types/projectType';

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  const display = value == null || value === '' ? '—' : value;
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2.5 last:border-0 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-slate-600">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm text-slate-900 sm:col-span-2">{display}</dd>
    </div>
  );
}

interface Props {
  title: string;
  fields: FormFieldDefinition[];
  project: Project;
  locations?: LocationNode[];
  projectTypes?: ProjectType[];
  locale?: 'en' | 'bn';
  hiddenKeys?: Set<string>;
}

export default function ProjectDetailsReadonly({
  title,
  fields,
  project,
  locations = [],
  projectTypes = [],
  locale = 'en',
  hiddenKeys = new Set(),
}: Props) {
  const { t } = useT();

  const sorted = useMemo(
    () => [...fields].sort((a, b) => a.display_order - b.display_order),
    [fields],
  );

  const hasCoords = sorted.some(
    (f) => f.field_key === 'latitude' || f.field_key === 'longitude' || f.field_key === 'map_coords',
  );

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

  const activeLocation = useMemo(
    () => locations.find((l) => l.id === project.location_id) ?? null,
    [locations, project.location_id],
  );

  const lat = Number(project.latitude);
  const lng = Number(project.longitude);
  const hasValidCoords = !Number.isNaN(lat) && !Number.isNaN(lng);

  if (!fields.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>

      <div className="space-y-6">
        {Array.from(sections.entries()).map(([section, sectionFields]) => (
          <div key={section}>
            {section !== 'default' && (
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t(`section.${section}`) !== `section.${section}` ? t(`section.${section}`) : section}
              </h3>
            )}
            <dl>
              {sectionFields.map((field) => (
                <DetailRow
                  key={field.field_key}
                  label={labelFor(field, locale)}
                  value={formatProjectFieldValue(field, project, { projectTypes, locations, locale })}
                />
              ))}
            </dl>
          </div>
        ))}

        {hasCoords && hasValidCoords && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('section.geo')}
            </h3>
            <dl className="mb-3">
              {project.location?.district && (
                <DetailRow label={t('projects.f.districtFilter')} value={project.location.district} />
              )}
              {project.location && (
                <DetailRow
                  label={t('projects.f.location')}
                  value={`${project.location.upazila} → ${project.location.union_name}`}
                />
              )}
              <DetailRow label={t('projects.f.lat')} value={lat} />
              <DetailRow label={t('projects.f.lng')} value={lng} />
            </dl>
            <LocationPicker
              latitude={lat}
              longitude={lng}
              onChange={() => {}}
              draggable={false}
              unionBounds={activeLocation?.bounds ?? null}
              unionBoundary={activeLocation?.boundary_geojson ?? null}
            />
          </div>
        )}
      </div>
    </div>
  );
}
