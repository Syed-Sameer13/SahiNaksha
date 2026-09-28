# Data Sources and Provenance

## Recommended datasets/resources

### SpaceNet
Useful for building/road extraction experiments.
https://www.spacenet.ai/datasets/

Do not describe its labels as Indian cadastral ground truth.

### Google Open Buildings
Useful as a building-footprint reference where its terms permit use.
https://sites.research.google/gr/open-buildings/

Use as reference/derived data, not legal parcel ownership data.

### OpenAerialMap
Useful for searching public aerial/drone imagery.
https://openaerialmap.org/

Check the license of each selected dataset.

### Bhuvan / NRSC
Useful for discovering Indian geospatial resources.
https://bhuvan.nrsc.gov.in/

Check the exact layer's terms before use or redistribution.

### Synthetic demo cadastral data
When official parcel data is unavailable, create synthetic parcel GeoJSON for demonstration.
Always label:
SYNTHETIC DEMO DATA — NOT AN OFFICIAL LAND RECORD

## Provenance record
For every external dataset record:
- dataset name
- source URL
- access date
- license/terms
- what it represents
- what it does not represent

## Do not
- upload proprietary government data without permission
- claim a building dataset is an official parcel record
- publish personal land-owner information
- commit huge raw imagery files to Git
