# System Architecture

## High-level flow

```
React + Leaflet WebGIS
          |
          v
    Node + Express
       /       \
      v         v
Supabase     FastAPI
PostGIS         |
                v
       Geospatial AI Engine
       /       |        \
      v        v         v
   SamGeo   GeoPandas  Shapely
      \        |        /
       v       v       v
           GeoJSON
              |
       +------+------+
       |             |
       v             v
   Topology      GIS reference
      QA          comparison
       \             /
        +-----+-----+
              v
      Surveyor verification
              |
              v
      GeoJSON / Shapefile / PDF
```

## Why Node + Python?
Node/Express handles authentication, projects, uploads, database access and business APIs. Python/FastAPI handles raster processing, model inference, vectorization and spatial QA.

## Data flow
1. User uploads a raster.
2. Backend stores file metadata and creates a survey job.
3. Backend calls Python.
4. Python validates CRS/raster metadata.
5. AI produces masks/features.
6. Masks become polygons.
7. Geometries are repaired/simplified.
8. Candidate parcels are generated.
9. Topology and reference comparisons run.
10. Python returns GeoJSON, metrics and issues.
11. Backend stores results.
12. React renders layers.
13. Surveyor edits/accepts/rejects.
14. Final/provisional outputs are exported.

## Production direction
For large surveys, use tiling, asynchronous jobs, GPU workers, immutable raw inputs, versioned outputs and audit logs.
