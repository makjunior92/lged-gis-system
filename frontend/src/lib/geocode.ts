import type { LocationNode } from '@/types/location';

/** Rough centroid lookup for seeded Feni unions (fallback when Nominatim is unavailable). */
const UNION_CENTROIDS: Record<string, [number, number]> = {
  Dharmapur: [22.8456, 91.1345],
  Sharshadi: [22.87, 91.15],
  'Char Chandia': [22.91, 91.38],
  Mongolkandi: [22.94, 91.43],
  Radhanagar: [23.02, 91.555],
};

export async function resolveUnionCoords(location: LocationNode): Promise<[number, number] | null> {
  const fallback = UNION_CENTROIDS[location.union_name];
  const query = `${location.union_name}, ${location.upazila}, ${location.district}, Bangladesh`;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return fallback ? fallback : null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (data.length > 0) {
      return [Number(Number(data[0].lat).toFixed(6)), Number(Number(data[0].lon).toFixed(6))];
    }
  } catch {
    /* use fallback */
  }
  return fallback ?? null;
}
