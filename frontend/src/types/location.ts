export interface DistrictItem {
  division: string;
  district: string;
}

export interface UpazilaItem {
  upazila: string;
}

export interface GeoBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface UnionPolygonGeometry {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface UnionMultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

export type UnionBoundaryGeometry = UnionPolygonGeometry | UnionMultiPolygonGeometry;

export interface LocationNode {
  id: number;
  division: string;
  district: string;
  upazila: string;
  union_name: string;
  centroid_lat?: number | null;
  centroid_lng?: number | null;
  bounds?: GeoBounds | null;
  boundary_geojson?: UnionBoundaryGeometry | null;
}
