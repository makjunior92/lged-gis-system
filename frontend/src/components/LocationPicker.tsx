import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, Marker, Rectangle, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Map, Satellite } from 'lucide-react';

import { boundsCenter, constrainToUnion, roundGisCoord } from '@/lib/geoBounds';
import { geoBoundsToLatLngBounds, unionBoundaryFeature, unionBoundaryLatLngBounds } from '@/lib/leafletGeo';
import {
  MAP_MAX_ZOOM,
  SATELLITE_LABEL_TILES,
  SATELLITE_TILES,
  STREET_TILES,
  type MapStyle,
} from '@/lib/mapTiles';
import { useT } from '@/contexts/I18nContext';
import type { GeoBounds, UnionBoundaryGeometry } from '@/types/location';

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const BD_BOUNDS: GeoBounds = { south: 20, west: 88, north: 27, east: 93 };

interface Props {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
  draggable?: boolean;
  unionBounds?: GeoBounds | null;
  unionBoundary?: UnionBoundaryGeometry | null;
}

const FENI_DEFAULT: [number, number] = [22.8456, 91.1345];

function ClickHandler({
  onChange,
  unionBounds,
  unionBoundary,
}: {
  onChange: (lat: number, lng: number) => void;
  unionBounds?: GeoBounds | null;
  unionBoundary?: UnionBoundaryGeometry | null;
}) {
  useMapEvents({
    click(e) {
      const next = constrainToUnion(
        Number(e.latlng.lat.toFixed(6)),
        Number(e.latlng.lng.toFixed(6)),
        unionBounds,
        unionBoundary,
      );
      if (next) onChange(next[0], next[1]);
    },
  });
  return null;
}

function Recenter({
  pos,
  zoom,
  unionBounds,
  unionBoundary,
}: {
  pos: [number, number] | null;
  zoom?: number;
  unionBounds?: GeoBounds | null;
  unionBoundary?: UnionBoundaryGeometry | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (unionBoundary) {
      map.fitBounds(unionBoundaryLatLngBounds(unionBoundary).pad(0.06), { maxZoom: 17 });
      return;
    }
    if (unionBounds) {
      map.fitBounds(geoBoundsToLatLngBounds(unionBounds).pad(0.06), { maxZoom: 17 });
      return;
    }
    if (pos) {
      map.setView(pos, zoom ?? (map.getZoom() < 10 ? 14 : map.getZoom()));
    }
  }, [pos, zoom, unionBounds, unionBoundary, map]);
  return null;
}

function DraggableMarker({
  position,
  onChange,
  unionBounds,
  unionBoundary,
}: {
  position: [number, number];
  onChange: (lat: number, lng: number) => void;
  unionBounds?: GeoBounds | null;
  unionBoundary?: UnionBoundaryGeometry | null;
}) {
  return (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const { lat, lng } = e.target.getLatLng();
          const next = constrainToUnion(
            Number(lat.toFixed(6)),
            Number(lng.toFixed(6)),
            unionBounds,
            unionBoundary,
          );
          if (next) {
            onChange(next[0], next[1]);
          } else {
            onChange(position[0], position[1]);
          }
        },
      }}
    />
  );
}

function MapTileLayers({ style }: { style: MapStyle }) {
  if (style === 'satellite') {
    return (
      <>
        <TileLayer
          url={SATELLITE_TILES.url}
          attribution={SATELLITE_TILES.attribution}
          maxZoom={MAP_MAX_ZOOM}
          maxNativeZoom={19}
        />
        <TileLayer
          url={SATELLITE_LABEL_TILES.url}
          attribution={SATELLITE_LABEL_TILES.attribution}
          maxZoom={MAP_MAX_ZOOM}
          maxNativeZoom={19}
          opacity={0.95}
          zIndex={2}
        />
      </>
    );
  }

  return (
    <TileLayer
      url={STREET_TILES.url}
      attribution={STREET_TILES.attribution}
      maxZoom={MAP_MAX_ZOOM}
      maxNativeZoom={20}
    />
  );
}

export default function LocationPicker({
  latitude,
  longitude,
  onChange,
  height = 320,
  draggable = true,
  unionBounds = null,
  unionBoundary = null,
}: Props) {
  const { t } = useT();
  const [mapStyle, setMapStyle] = useState<MapStyle>('street');
  const activeBounds = unionBounds ?? null;
  const hasUnionRestriction = !!(activeBounds || unionBoundary);

  const boundaryFeature = useMemo(
    () => (unionBoundary ? unionBoundaryFeature(unionBoundary) : null),
    [unionBoundary],
  );

  const pos: [number, number] | null = useMemo(() => {
    if (latitude == null || longitude == null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return null;
    }
    if (latitude < BD_BOUNDS.south || latitude > BD_BOUNDS.north) return null;
    if (longitude < BD_BOUNDS.west || longitude > BD_BOUNDS.east) return null;
    const constrained = constrainToUnion(latitude, longitude, activeBounds, unionBoundary);
    return constrained ?? (activeBounds ? boundsCenter(activeBounds) : [roundGisCoord(latitude), roundGisCoord(longitude)]);
  }, [latitude, longitude, activeBounds, unionBoundary]);

  const center: [number, number] = useMemo(() => {
    if (unionBoundary) {
      const b = unionBoundaryLatLngBounds(unionBoundary);
      return [b.getCenter().lat, b.getCenter().lng];
    }
    if (activeBounds) return boundsCenter(activeBounds);
    return pos ?? FENI_DEFAULT;
  }, [activeBounds, unionBoundary, pos]);

  const maxBounds = useMemo(() => {
    if (unionBoundary) {
      return unionBoundaryLatLngBounds(unionBoundary).pad(0.12);
    }
    if (!activeBounds) return undefined;
    return geoBoundsToLatLngBounds(activeBounds).pad(0.15);
  }, [activeBounds, unionBoundary]);

  const handleChange = (lat: number, lng: number) => {
    const next = constrainToUnion(lat, lng, activeBounds, unionBoundary);
    if (next) onChange(next[0], next[1]);
  };

  return (
    <div className="relative overflow-hidden rounded-md border border-slate-300" style={{ height }}>
      <div className="absolute right-2 top-2 z-[1000] flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setMapStyle('street')}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
            mapStyle === 'street'
              ? 'bg-brand-600 text-white'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
          title={t('geo.mapLayerStreet')}
        >
          <Map size={14} />
          {t('geo.mapLayerStreet')}
        </button>
        <button
          type="button"
          onClick={() => setMapStyle('satellite')}
          className={`flex items-center gap-1 border-l border-slate-200 px-2.5 py-1.5 text-xs font-medium transition-colors ${
            mapStyle === 'satellite'
              ? 'bg-brand-600 text-white'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
          title={t('geo.mapLayerSatellite')}
        >
          <Satellite size={14} />
          {t('geo.mapLayerSatellite')}
        </button>
      </div>

      <MapContainer
        center={center}
        zoom={hasUnionRestriction ? 15 : pos ? 14 : 12}
        className="h-full w-full"
        maxBounds={maxBounds}
        maxBoundsViscosity={1.0}
        minZoom={hasUnionRestriction ? 11 : 8}
        maxZoom={MAP_MAX_ZOOM}
      >
        <MapTileLayers style={mapStyle} />
        {boundaryFeature ? (
          <GeoJSON
            data={boundaryFeature}
            style={{
              color: '#0d9488',
              weight: 2,
              fillColor: '#14b8a6',
              fillOpacity: 0.18,
            }}
          />
        ) : activeBounds ? (
          <Rectangle
            bounds={geoBoundsToLatLngBounds(activeBounds)}
            pathOptions={{
              color: '#0d9488',
              weight: 2,
              fillColor: '#14b8a6',
              fillOpacity: 0.15,
            }}
          />
        ) : null}
        {draggable && (
          <ClickHandler onChange={handleChange} unionBounds={activeBounds} unionBoundary={unionBoundary} />
        )}
        {pos && draggable ? (
          <DraggableMarker
            position={pos}
            onChange={handleChange}
            unionBounds={activeBounds}
            unionBoundary={unionBoundary}
          />
        ) : pos ? (
          <Marker position={pos} />
        ) : null}
        <Recenter pos={pos} unionBounds={activeBounds} unionBoundary={unionBoundary} />
      </MapContainer>
    </div>
  );
}
