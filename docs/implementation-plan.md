# 72-Hour Implementation Plan

## Day 1 — Foundation
- repository structure
- React shell
- Node/Express API
- database
- FastAPI service
- one test raster
- one GeoJSON result
- map display

Target:
upload -> process -> GeoJSON -> map

## Day 2 — Core product
- AI/segmentation
- raster-to-vector
- candidate parcels
- topology
- confidence/review score
- existing/reference comparison
- parcel review/edit

Target:
upload -> AI -> parcels -> map -> validation

## Day 3 — Productization
- authentication
- export
- PDF report
- UI polish
- browser tests
- deployment
- README
- PPT
- demo video

## Team ownership

### Sameer
Product, GIS methodology, topology rules, integration, QA, SIH documentation

### Adil
Python, FastAPI, AI/segmentation, raster processing, vectorization, geospatial QA

### Arshad
React, Leaflet, Node/Express, Supabase/PostGIS, authentication, deployment

## Scope rule
If upload -> process -> map -> verify -> export is not stable, stop adding stretch features.
