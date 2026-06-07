import { api } from '@/lib/api';
import type { DistrictItem, LocationNode, UpazilaItem } from '@/types/location';

export async function listDistricts(): Promise<DistrictItem[]> {
  const res = await api.get<DistrictItem[]>('/locations/districts');
  return res.data;
}

export async function listUpazilas(district?: string): Promise<UpazilaItem[]> {
  const res = await api.get<UpazilaItem[]>('/locations/upazilas', {
    params: district ? { district } : {},
  });
  return res.data;
}

export async function listAllLocations(): Promise<LocationNode[]> {
  const res = await api.get<LocationNode[]>('/locations/all');
  return res.data;
}
