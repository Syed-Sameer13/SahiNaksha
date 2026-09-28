# SahiNaksha

AI-assisted Urban Cadastral Mapping & Verification Platform for SIH PS 26012.

## Purpose

SahiNaksha converts high-resolution aerial/drone survey data into **preliminary, GIS-ready cadastral features** and provides a surveyor workflow to inspect, validate, edit and export them.

> Important: AI-generated parcel boundaries are preliminary. They are not legal proof of ownership or an official cadastral record. Final acceptance belongs to the authorized survey/land-record workflow.

## Core workflow

Drone / Orthomosaic + optional DSM/DTM + existing GIS
-> preprocessing
-> AI feature extraction
-> polygonization
-> candidate parcel generation
-> topology validation
-> existing-vs-AI comparison
-> confidence / review priority
-> surveyor edit and verification
-> GeoJSON / Shapefile / PDF report

## Planned stack

- Frontend: React + Vite + Tailwind + React Leaflet
- Backend: Node.js + Express
- AI/Geospatial: Python + FastAPI + PyTorch + SamGeo + Rasterio + GeoPandas + Shapely
- Database: PostgreSQL/Supabase + PostGIS where available
- GIS validation: QGIS
- Version control: GitHub

## Team

- Sameer — product, GIS concepts, integration, QA and documentation
- Adil — Python, geospatial AI and image processing
- Arshad — MERN, APIs, database and WebGIS frontend

## Repository structure

```
frontend/       React/WebGIS
backend/        Node/Express APIs
ai-engine/      Python/FastAPI geospatial AI
data/           demo/sample data (no large binaries)
docs/           architecture, data, API and methodology
```

## Development principle

Use AI coding agents to accelerate implementation, but keep architecture, GIS assumptions, data provenance, validation rules and product claims human-reviewed.

## Status

Prototype in active development.
