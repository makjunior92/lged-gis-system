/** Labeled street + satellite tile providers (no API key required). */

export type MapStyle = 'street' | 'satellite';

export const MAP_MAX_ZOOM = 19;

export const STREET_TILES = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> '
    + '&copy; <a href="https://carto.com/attributions">CARTO</a>',
};

export const SATELLITE_TILES = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution:
    'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Source: Esri, Maxar, Earthstar Geographics',
};

/** Label overlay for hybrid satellite view (Google-style). */
export const SATELLITE_LABEL_TILES = {
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
  attribution: '',
};
