import type { GeoBounds, UnionBoundaryGeometry } from '@/types/location';

/** Match backend Decimal(9,6) and PostGIS point precision (~0.1 m). */
export const GIS_COORD_DECIMALS = 6;

export function roundGisCoord(value: number): number {
  return Number(value.toFixed(GIS_COORD_DECIMALS));
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = (yi > lat) !== (yj > lat)
      && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-15) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInBoundary(lat: number, lng: number, boundary: UnionBoundaryGeometry): boolean {
  if (boundary.type === 'Polygon') {
    const rings = boundary.coordinates;
    if (!rings.length) return false;
    if (!pointInRing(lng, lat, rings[0])) return false;
    for (let i = 1; i < rings.length; i++) {
      if (pointInRing(lng, lat, rings[i])) return false;
    }
    return true;
  }
  return boundary.coordinates.some((polyCoords) =>
    pointInBoundary(lat, lng, { type: 'Polygon', coordinates: polyCoords }),
  );
}

/** Clamp to bbox, then ensure point lies inside GIS polygon when available. */
export function constrainToUnion(
  lat: number,
  lng: number,
  bounds: GeoBounds | null | undefined,
  boundary: UnionBoundaryGeometry | null | undefined,
): [number, number] | null {
  let clat = lat;
  let clng = lng;
  if (bounds) [clat, clng] = clampToBounds(clat, clng, bounds);
  if (boundary && !pointInBoundary(clat, clng, boundary)) {
    return null;
  }
  return [roundGisCoord(clat), roundGisCoord(clng)];
}

export function isInsideBounds(lat: number, lng: number, bounds: GeoBounds): boolean {
  return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
}

/** Snap a point to the nearest edge of the bounding box. */
export function clampToBounds(lat: number, lng: number, bounds: GeoBounds): [number, number] {
  const clampedLat = Math.min(bounds.north, Math.max(bounds.south, lat));
  const clampedLng = Math.min(bounds.east, Math.max(bounds.west, lng));
  return [roundGisCoord(clampedLat), roundGisCoord(clampedLng)];
}

export function boundsCenter(bounds: GeoBounds): [number, number] {
  return [
    roundGisCoord((bounds.south + bounds.north) / 2),
    roundGisCoord((bounds.west + bounds.east) / 2),
  ];
}
