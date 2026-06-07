# Bangladesh administrative boundary data

Union parishad polygons used for map restriction and coordinate validation.

## Bundled files (Feni district demo)

| File | Source level | Content |
| --- | --- | --- |
| `bd_adm3_feni_upazilas.geojson` | ADM3 | 6 upazilas in Feni district |
| `bd_adm4_feni_unions.geojson` | ADM4 | 48 union polygons in Feni district |

Extracted from [geoBoundaries](https://www.geoboundaries.org) open release (CC BY 3.0 IGO), simplified geometries.

## Nationwide import (production)

1. Download simplified GeoJSON from geoBoundaries API:
   - ADM3: `geoBoundaries-BGD-ADM3_simplified.geojson`
   - ADM4: `geoBoundaries-BGD-ADM4_simplified.geojson`
2. Set environment variables:
   - `BOUNDARY_GEOJSON_ADM3=/path/to/ADM3.geojson`
   - `BOUNDARY_GEOJSON_ADM4=/path/to/ADM4.geojson`
3. Ensure `location_hierarchy` rows exist for each union (district + upazila + union_name).
4. Add spelling aliases in `union_aliases.json` where seed names differ from GIS names.
5. Restart backend with `SEED_IMPORT_BOUNDARIES=true`.

## LGED GSIMS (optional)

LGED operates an ArcGIS FeatureServer with union boundaries (`mapgis.lged.gov.bd`). It can be wired in later for official LGED-aligned geometry; this prototype uses geoBoundaries for offline/docker-friendly imports.

## Attribution

Boundary data: geoBoundaries.org / Bangladesh Bureau of Statistics / OCHA ROAP (CC BY 3.0 IGO).
