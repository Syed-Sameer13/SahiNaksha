# SahiNaksha Requirements

## Goal
Turn aerial/drone survey data into preliminary urban cadastral features that an authorized surveyor can inspect, validate, edit and export.

## Users

### Surveyor
- Create survey project
- Upload survey data
- Start processing
- View map layers
- Inspect parcels
- View confidence and validation issues
- Edit geometry
- Accept/reject/request field verification
- Export results

### Administrator
- Manage users/projects
- View processing status
- Review audit information

## MVP inputs
Required:
- Georeferenced orthomosaic/raster

Optional:
- DSM
- DTM
- Existing parcel GIS layer
- Building/road reference layer
- Ground-truth points/polygons

## MVP processing
1. Validate file and CRS.
2. Preprocess raster.
3. Run AI-assisted feature extraction.
4. Convert masks to vector polygons.
5. Repair/simplify geometries.
6. Generate candidate parcel boundaries.
7. Calculate area in an appropriate projected CRS.
8. Run topology checks.
9. Compare with existing GIS reference when provided.
10. Generate an explainable review/confidence score.

## Review
Surveyor can:
- Select parcel
- View attributes
- View evidence
- View issues
- Edit geometry
- Save changes
- Change status

## Export
- GeoJSON
- CSV
- PDF survey summary
- Shapefile as stretch goal

## Non-functional
- Responsive WebGIS UI
- Clear error/loading/empty states
- No secrets in client code
- Input validation
- Audit-friendly statuses
- Reproducible demo
- Clear data provenance

## Important limitation
SahiNaksha provides preliminary AI-assisted cadastral features. Imagery alone cannot establish legal ownership or guarantee an official cadastral boundary.
