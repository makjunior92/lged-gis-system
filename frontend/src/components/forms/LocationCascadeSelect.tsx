import { useEffect, useMemo, useState } from 'react';

import Select from '@/components/ui/Select';
import { useT } from '@/contexts/I18nContext';
import type { LocationNode } from '@/types/location';

interface BaseProps {
  locations: LocationNode[];
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

interface UnionModeProps extends BaseProps {
  mode: 'union';
  valueLocationId: number | '' | undefined;
  onLocationIdChange: (id: number | '') => void;
}

interface UpazilaModeProps extends BaseProps {
  mode: 'upazila';
  valueUpazilaKey: string | undefined;
  onUpazilaKeyChange: (key: string) => void;
}

type Props = UnionModeProps | UpazilaModeProps;

function parseUpazilaKey(key: string | undefined): { district: string; upazila: string } {
  if (!key) return { district: '', upazila: '' };
  const [district, ...rest] = key.split('|');
  return { district: district ?? '', upazila: rest.join('|') };
}

export default function LocationCascadeSelect(props: Props) {
  const { t } = useT();
  const { locations, error, required, disabled, mode } = props;

  const districts = useMemo(
    () => Array.from(new Set(locations.map((l) => l.district))).sort(),
    [locations],
  );

  const initialDistrict =
    mode === 'union'
      ? locations.find((l) => l.id === Number(props.valueLocationId))?.district ?? ''
      : parseUpazilaKey(props.valueUpazilaKey).district;

  const initialUpazila =
    mode === 'union'
      ? locations.find((l) => l.id === Number(props.valueLocationId))?.upazila ?? ''
      : parseUpazilaKey(props.valueUpazilaKey).upazila;

  const [district, setDistrict] = useState(initialDistrict);
  const [upazila, setUpazila] = useState(initialUpazila);

  useEffect(() => {
    if (mode === 'union') {
      const loc = locations.find((l) => l.id === Number(props.valueLocationId));
      setDistrict(loc?.district ?? '');
      setUpazila(loc?.upazila ?? '');
    } else {
      const parsed = parseUpazilaKey(props.valueUpazilaKey);
      setDistrict(parsed.district);
      setUpazila(parsed.upazila);
    }
  }, [mode, locations, mode === 'union' ? props.valueLocationId : props.valueUpazilaKey]);

  const upazilas = useMemo(() => {
    if (!district) return [];
    return Array.from(
      new Set(locations.filter((l) => l.district === district).map((l) => l.upazila)),
    ).sort();
  }, [locations, district]);

  const unions = useMemo(() => {
    if (!district || !upazila) return [];
    return locations
      .filter((l) => l.district === district && l.upazila === upazila)
      .sort((a, b) => a.union_name.localeCompare(b.union_name));
  }, [locations, district, upazila]);

  function handleDistrictChange(next: string) {
    setDistrict(next);
    setUpazila('');
    if (mode === 'union') {
      props.onLocationIdChange('');
    } else {
      props.onUpazilaKeyChange('');
    }
  }

  function handleUpazilaChange(next: string) {
    setUpazila(next);
    if (mode === 'union') {
      props.onLocationIdChange('');
    } else if (district && next) {
      props.onUpazilaKeyChange(`${district}|${next}`);
    } else {
      props.onUpazilaKeyChange('');
    }
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Select
        label={t('projects.f.districtFilter')}
        value={district}
        onChange={(e) => handleDistrictChange(e.target.value)}
        required={required}
        disabled={disabled}
      >
        <option value="">{t('common.select')}</option>
        {districts.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>

      <Select
        label={t('users.upazila')}
        value={upazila}
        onChange={(e) => handleUpazilaChange(e.target.value)}
        required={required}
        disabled={disabled || !district}
      >
        <option value="">{t('common.select')}</option>
        {upazilas.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </Select>

      {mode === 'union' && (
        <Select
          label={t('projects.f.location')}
          className="md:col-span-2"
          value={props.valueLocationId ? String(props.valueLocationId) : ''}
          onChange={(e) => {
            const val = e.target.value;
            props.onLocationIdChange(val ? Number(val) : '');
          }}
          error={error}
          required={required}
          disabled={disabled || !upazila}
        >
          <option value="">{t('common.select')}</option>
          {unions.map((l) => (
            <option key={l.id} value={l.id}>
              {l.union_name}
            </option>
          ))}
        </Select>
      )}

      {mode === 'upazila' && error && (
        <p className="md:col-span-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
