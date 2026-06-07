import type { Feature, Polygon } from 'geojson';
import L from 'leaflet';

import type { GeoBounds, UnionBoundaryGeometry } from '@/types/location';

export function geoBoundsToLatLngBounds(bounds: GeoBounds): L.LatLngBounds {
  return L.latLngBounds(
    [bounds.south, bounds.west],
    [bounds.north, bounds.east],
  );
}

export function unionBoundaryFeature(geometry: UnionBoundaryGeometry): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: geometry as Polygon,
  };
}

export function unionBoundaryLatLngBounds(geometry: UnionBoundaryGeometry): L.LatLngBounds {
  const layer = L.geoJSON(unionBoundaryFeature(geometry));
  return layer.getBounds();
}
