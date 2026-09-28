# SahiNaksha Agent Rules

## Project
SahiNaksha is an AI-assisted urban cadastral mapping and verification prototype for SIH PS 26012.

## Architecture
- frontend/: React + Vite + Tailwind + React Leaflet
- backend/: Node.js + Express
- ai-engine/: Python + FastAPI + Rasterio + GeoPandas + Shapely + SamGeo/PyTorch
- database: PostgreSQL/Supabase; use PostGIS for spatial operations where available
- data/: small demo/reference data only; do not commit large raw imagery

## Code ownership
- frontend agents work mainly in frontend/
- backend agents work mainly in backend/
- geospatial AI agents work mainly in ai-engine/
- avoid unrelated edits across ownership boundaries

## GIS rules
1. Preserve CRS information.
2. Never silently change CRS.
3. Do not calculate metric area on geographic coordinates such as EPSG:4326 without transforming to a suitable projected CRS.
4. Validate GeoJSON before returning it.
5. Repair or explicitly reject invalid geometries.
6. Treat AI-generated parcel boundaries as preliminary/inferred.
7. Never claim AI output is an official cadastral record or legal ownership proof.
8. Never present synthetic/demo parcel data as government data.
9. Record source and processing status where practical.
10. Confidence scores are decision-support scores unless statistically calibrated.

## Engineering rules
1. Inspect existing code before editing.
2. Explain the planned change before major implementation.
3. Keep modules small and reusable.
4. Do not add dependencies unless needed.
5. Do not rewrite unrelated files.
6. Keep secrets out of source control.
7. Add error handling around file processing and external APIs.
8. Add tests for geometry and API logic.
9. Prefer deterministic demo data.
10. Keep a demo/reference mode when model inference is unavailable.

## Definition of done
A feature is done only when it runs, the happy path works, failure states are handled, outputs are validated, and the responsible team member can explain it.
