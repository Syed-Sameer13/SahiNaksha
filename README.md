# SahiNaksha 🗺️

## AI-Assisted Urban Parcel Mapping and Cadastral Feature Extraction

SahiNaksha is an SIH26012-oriented MVP for preparing **preliminary urban cadastral maps** from drone/orthomosaic imagery and supporting GIS reference data.

## What the SIH26012 workflow requires

The target workflow is:

```text
High-resolution Drone / Orthomosaic
              +
Existing GIS Parcel Layer
              +
Ground-truth / survey evidence
              ↓
AI / CV boundary and feature extraction
              ↓
Parcel polygon generation / refinement
              ↓
Topology validation
              ↓
Land-use classification
              ↓
Web-GIS review
              ↓
GIS-ready cadastral output
```

### Current implemented MVP modes

#### 1. Image-only evidence mode
Input:
- JPG/PNG drone image

Output:
- Conservative building evidence
- Conservative road candidates
- No fabricated cadastral parcel boundaries

This mode intentionally does **not** claim that invisible legal parcel boundaries can be recovered from RGB pixels alone.

#### 2. Reference-guided cadastral mode
Input:
- Drone / orthomosaic image
- Existing parcel GeoJSON aligned to the image in normalized local coordinates (0..100)

Output:
- Preliminary cadastral parcel polygons
- Drone-edge boundary refinement
- Parcel boundary evidence score
- Land-use classification
- Shapely topology validation
- Web-GIS visualization
- GeoJSON export

## Run locally

See [SETUP.md](SETUP.md).

## Important prototype coordinate convention

The current Web-GIS prototype uses Leaflet's image-local coordinate space:

- Left edge = X 0
- Right edge = X 100
- Bottom edge = Y 0
- Top edge = Y 100

Therefore the current reference parcel GeoJSON input must already be aligned to that image-local 0..100 coordinate system.

A full production deployment should instead support georeferenced orthomosaics, CRS transformations, DSM/DTM and GNSS/CORS survey data.

## Honest limitation

SahiNaksha is a prototype. The current reference-guided cadastral mode is a defensible MVP workflow, but the project still needs a trained or domain-adapted segmentation model for reliable **image-only automatic parcel extraction**.

For SIH demonstration, the recommended end-to-end demo is:

```text
Drone Orthomosaic
      +
Existing GIS Parcel Layer
      ↓
SahiNaksha refinement
      ↓
Land-use + feature evidence
      ↓
Topology validation
      ↓
Surveyor review
      ↓
GeoJSON cadastral output
```

This demonstrates the actual cadastral workflow instead of pretending that a single non-georeferenced RGB image can reveal every legal property boundary.
