# GIS Methodology

## Orthomosaic
A georeferenced, distortion-corrected mosaic created from overlapping aerial images.

## DSM
Digital Surface Model. It includes object surfaces such as buildings and trees.

## DTM
Digital Terrain Model. It represents terrain/bare earth.

## Raster vs vector
Raster = pixels/grid (imagery, DSM, masks).
Vector = points/lines/polygons (roads, buildings, parcels).

Typical pipeline:
Raster -> AI mask -> vector polygon.

## CRS
A Coordinate Reference System tells software how coordinates relate to the earth.

EPSG:4326 stores longitude/latitude in degrees. Projected CRSs can use metres and are required for many area/distance calculations.

Never assume a CRS.

## Parcel vs building
A building footprint is the mapped footprint of a structure.
A parcel is a land unit and may include buildings, yards, access space and vacant land.

Therefore:
building footprint != parcel boundary.

## Topology
Topology captures spatial relationships. Typical checks include overlap, gap, valid geometry and containment.

## Human verification
Not every legal parcel boundary is visible in imagery. SahiNaksha therefore treats AI output as preliminary and routes uncertain/discrepant cases for surveyor/field verification.
