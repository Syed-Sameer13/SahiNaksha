# Testing Strategy

## Frontend
Test login states, upload validation, map layers, parcel selection, editing, verification, export, loading/error/empty states.

## Backend
Test authentication, project CRUD, upload validation, job lifecycle, permissions and errors.

## Geospatial
Use small deterministic geometries for:
- valid polygon
- overlap
- gap
- self-intersection
- building outside parcel
- area mismatch
- CRS transformation

Each rule needs positive and negative tests.

## AI smoke test
Keep one small demo raster that can be processed repeatedly.

Acceptance:
- model initializes
- output exists
- GeoJSON is valid
- CRS/metadata is present
- empty/invalid outputs are handled

## End-to-end
Login -> project -> upload -> process -> map -> parcel -> issue -> edit -> verify -> export

This workflow must work before the SIH demo.

## Performance
Measure upload time, processing time, output feature count and memory usage.
Do not claim nationwide scale without testing.
