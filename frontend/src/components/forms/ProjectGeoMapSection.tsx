import { useEffect, useMemo, useState } from 'react';
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormSetValue,
} from 'react-hook-form';
import { Search } from 'lucide-react';

import LocationPicker from '@/components/LocationPicker';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useT } from '@/contexts/I18nContext';
import { boundsCenter, clampToBounds, constrainToUnion, roundGisCoord } from '@/lib/geoBounds';
import { resolveUnionCoords } from '@/lib/geocode';
import type { GeoBounds, LocationNode, UnionBoundaryGeometry } from '@/types/location';

interface Props {
  control: Control<Record<string, unknown>>;
  setValue: UseFormSetValue<Record<string, unknown>>;
  errors: FieldErrors<Record<string, unknown>>;
  locations: LocationNode[];
  lockedLocationId?: number | null;
  lockedDistrict?: string | null;
  showDistrict?: boolean;
  showUnion?: boolean;
  readOnly?: boolean;
}

export default function ProjectGeoMapSection({
  control,
  setValue,
  errors,
  locations,
  lockedLocationId = null,
  lockedDistrict = null,
  showDistrict = true,
  showUnion = true,
  readOnly = false,
}: Props) {
  const { t } = useT();
  const [unionSearch, setUnionSearch] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  const selectedDistrict = useWatch({ control, name: 'district' }) as string | undefined;
  const selectedLocationId = useWatch({ control, name: 'location_id' }) as string | number | undefined;
  const latitude = useWatch({ control, name: 'latitude' });
  const longitude = useWatch({ control, name: 'longitude' });

  const unionLocked = lockedLocationId != null && lockedLocationId > 0;
  const districtFilter = lockedDistrict ?? selectedDistrict;

  useEffect(() => {
    if (unionLocked && lockedLocationId) {
      setValue('location_id', lockedLocationId, { shouldValidate: true });
    }
    if (lockedDistrict) {
      setValue('district', lockedDistrict, { shouldValidate: true });
    }
  }, [unionLocked, lockedLocationId, lockedDistrict, setValue]);

  const districts = useMemo(
    () => Array.from(new Set(locations.map((l) => l.district))).sort(),
    [locations],
  );

  const unionOptions = useMemo(() => {
    let opts = lockedLocationId
      ? locations.filter((l) => l.id === lockedLocationId)
      : locations;
    if (districtFilter && !lockedLocationId) {
      opts = opts.filter((l) => l.district === districtFilter);
    }
    if (!unionLocked && unionSearch.trim()) {
      const q = unionSearch.toLowerCase();
      opts = opts.filter(
        (l) =>
          l.union_name.toLowerCase().includes(q) ||
          l.upazila.toLowerCase().includes(q) ||
          l.district.toLowerCase().includes(q),
      );
    }
    return opts;
  }, [locations, lockedLocationId, districtFilter, unionSearch, unionLocked]);

  const latNum = latitude != null && latitude !== '' ? Number(latitude) : null;
  const lngNum = longitude != null && longitude !== '' ? Number(longitude) : null;

  const activeLocation = useMemo(() => {
    const locId = lockedLocationId ?? (selectedLocationId ? Number(selectedLocationId) : null);
    if (!locId || Number.isNaN(locId)) return null;
    return locations.find((l) => l.id === locId) ?? null;
  }, [locations, lockedLocationId, selectedLocationId]);

  const activeUnionBounds: GeoBounds | null = activeLocation?.bounds ?? null;
  const activeUnionBoundary: UnionBoundaryGeometry | null =
    activeLocation?.boundary_geojson ?? null;

  function applyUnionCoords(lat: number, lng: number): [number, number] {
    const next = constrainToUnion(lat, lng, activeUnionBounds, activeUnionBoundary);
    if (next) return next;
    if (activeUnionBounds) return boundsCenter(activeUnionBounds);
    return [roundGisCoord(lat), roundGisCoord(lng)];
  }

  async function handleUnionChange(locationId: string) {
    if (!locationId) return;
    const loc = locations.find((l) => l.id === Number(locationId));
    if (!loc) return;
    const bounds = loc.bounds ?? null;
    setGeocoding(true);
    try {
      let coords: [number, number] | null = null;
      if (loc.centroid_lat != null && loc.centroid_lng != null) {
        coords = [roundGisCoord(loc.centroid_lat), roundGisCoord(loc.centroid_lng)];
      } else {
        coords = await resolveUnionCoords(loc);
      }
      if (coords) {
        const [lat, lng] = bounds ? clampToBounds(coords[0], coords[1], bounds) : coords;
        setValue('latitude', lat, { shouldValidate: true, shouldDirty: true });
        setValue('longitude', lng, { shouldValidate: true, shouldDirty: true });
      } else if (bounds) {
        const [lat, lng] = boundsCenter(bounds);
        setValue('latitude', lat, { shouldValidate: true, shouldDirty: true });
        setValue('longitude', lng, { shouldValidate: true, shouldDirty: true });
      }
    } finally {
      setGeocoding(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
        {t('section.geo')}
      </h3>

      <div className="grid gap-4 md:grid-cols-2">
        {showDistrict && (
          <Controller
            name="district"
            control={control}
            render={({ field }) =>
              lockedDistrict && unionLocked ? (
                <div className="flex flex-col gap-1">
                  <input type="hidden" {...field} value={lockedDistrict} />
                  <span className="text-sm font-medium text-slate-700">{t('projects.f.districtFilter')}</span>
                  <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                    {lockedDistrict}
                  </p>
                </div>
              ) : (
                <Select
                  label={t('projects.f.districtFilter')}
                  value={String(field.value ?? '')}
                  disabled={readOnly || !!lockedDistrict}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    setValue('location_id', '', { shouldDirty: true });
                  }}
                  error={errors.district?.message as string}
                  required
                >
                  <option value="">{t('common.select')}</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              )
            }
          />
        )}

        {showUnion && (
          <div className="space-y-2">
            {unionLocked ? (
              <Controller
                name="location_id"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <input type="hidden" {...field} value={lockedLocationId ?? ''} />
                    <span className="text-sm font-medium text-slate-700">{t('projects.f.location')}</span>
                    <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                      {activeLocation
                        ? `${activeLocation.upazila} → ${activeLocation.union_name}`
                        : '—'}
                    </p>
                  </div>
                )}
              />
            ) : (
              <>
                {!readOnly && (
                  <div className="relative">
                    <Search size={14} className="pointer-events-none absolute left-3 top-[2.125rem] text-slate-400" />
                    <Input
                      label={t('geo.searchUnion')}
                      placeholder={t('geo.searchUnionPlaceholder')}
                      value={unionSearch}
                      onChange={(e) => setUnionSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                )}
                <Controller
                  name="location_id"
                  control={control}
                  render={({ field }) => (
                    <Select
                      label={t('projects.f.location')}
                      value={String(field.value ?? '')}
                      disabled={readOnly || geocoding}
                      onChange={async (e) => {
                        const val = e.target.value;
                        field.onChange(val ? Number(val) : '');
                        if (val) await handleUnionChange(val);
                      }}
                      error={errors.location_id?.message as string}
                      required
                    >
                      <option value="">{t('common.select')}</option>
                      {unionOptions.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.upazila} → {l.union_name}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </>
            )}
          </div>
        )}
      </div>

      <Controller
        name="latitude"
        control={control}
        render={({ field: latField }) => (
          <Controller
            name="longitude"
            control={control}
            render={({ field: lngField }) => (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    type="number"
                    step="any"
                    label={t('projects.f.lat')}
                    value={
                      typeof latField.value === 'number' || typeof latField.value === 'string'
                        ? latField.value
                        : ''
                    }
                    onChange={(e) => {
                      if (readOnly) return;
                      const v = e.target.value === '' ? '' : Number(e.target.value);
                      if (v === '' || !activeUnionBounds) {
                        latField.onChange(v);
                        return;
                      }
                      const lng = lngField.value === '' || lngField.value == null
                        ? boundsCenter(activeUnionBounds)[1]
                        : Number(lngField.value);
                      const [clat, clng] = applyUnionCoords(Number(v), lng);
                      latField.onChange(clat);
                      lngField.onChange(clng);
                    }}
                    error={errors.latitude?.message as string}
                    required
                    readOnly={readOnly}
                    hint={readOnly ? undefined : activeUnionBounds ? t('geo.unionBoundaryHint') : t('projects.f.latHint')}
                  />
                  <Input
                    type="number"
                    step="any"
                    label={t('projects.f.lng')}
                    value={
                      typeof lngField.value === 'number' || typeof lngField.value === 'string'
                        ? lngField.value
                        : ''
                    }
                    onChange={(e) => {
                      if (readOnly) return;
                      const v = e.target.value === '' ? '' : Number(e.target.value);
                      if (v === '' || !activeUnionBounds) {
                        lngField.onChange(v);
                        return;
                      }
                      const lat = latField.value === '' || latField.value == null
                        ? boundsCenter(activeUnionBounds)[0]
                        : Number(latField.value);
                      const [clat, clng] = applyUnionCoords(lat, Number(v));
                      latField.onChange(clat);
                      lngField.onChange(clng);
                    }}
                    error={errors.longitude?.message as string}
                    required
                    readOnly={readOnly}
                    hint={readOnly ? undefined : activeUnionBounds ? t('geo.unionBoundaryHint') : t('projects.f.lngHint')}
                  />
                </div>

                <div className="mt-3">
                  <LocationPicker
                    latitude={latNum}
                    longitude={lngNum}
                    draggable={!readOnly}
                    unionBounds={activeUnionBounds}
                    unionBoundary={activeUnionBoundary}
                    onChange={(lat, lng) => {
                      if (readOnly) return;
                      latField.onChange(lat);
                      lngField.onChange(lng);
                    }}
                  />
                  {!readOnly && (
                    <p className="mt-2 text-xs text-slate-500">
                      {activeUnionBounds || activeUnionBoundary
                        ? t('geo.mapRestrictedHint')
                        : t('geo.mapHintTwoWay')}
                    </p>
                  )}
                  {activeLocation && !unionLocked && (
                    <p className="mt-1 text-xs text-brand-600">
                      {t('geo.selectedUnion')}: {activeLocation.union_name}
                      {geocoding && ` (${t('common.loading')})`}
                    </p>
                  )}
                </div>
              </>
            )}
          />
        )}
      />
    </div>
  );
}
