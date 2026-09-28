# AI and Geospatial Pipeline

## Goal
Convert georeferenced aerial imagery into candidate geospatial features.

## 1. Raster validation
Check file readability, dimensions, bands, CRS, affine transform and nodata metadata where relevant.

## 2. Preprocessing
Possible operations:
- tiling
- resize
- normalization
- nodata handling

Large images should be tiled rather than loaded fully into memory.

## 3. Segmentation
A geospatial segmentation workflow such as SamGeo/SAM can generate object masks.

Important: segmentation identifies image regions. It does not by itself prove a legal cadastral parcel.

## 4. Vectorization
Convert masks to polygons, remove tiny noise, simplify carefully and repair invalid geometry.

## 5. Feature interpretation
Candidate features:
- buildings
- roads
- walls/boundaries
- vegetation/open areas

## 6. Parcel inference
Combine available evidence:
- existing parcel boundaries
- building relationships
- roads/access corridors
- visible boundary structures
- adjacency

Mark unsupported outputs as AI-inferred.

## 7. Topology
Check:
- overlaps
- gaps
- self-intersections
- invalid polygons
- unexpected spatial relationships

## 8. Reference comparison
When an existing GIS layer is present:
- compare area
- compare intersections/overlaps
- calculate meaningful boundary differences
- flag discrepancies

## 9. Confidence/review score
Use an explainable score based on available evidence. Do not call it a calibrated probability without validation.

## 10. Output
Return:
- GeoJSON
- metrics
- confidence/review scores
- validation issues
- processing metadata
