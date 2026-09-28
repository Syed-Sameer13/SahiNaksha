# API Contract

Define the contract before dependent agents implement their modules.

## Health
GET /api/health

```json
{"status":"ok"}
```

## Projects
POST /api/projects
GET /api/projects
GET /api/projects/:id

## Surveys
POST /api/surveys
GET /api/surveys/:id
POST /api/surveys/:id/process

## Processing
POST /api/processing/:surveyId/start

```json
{"jobId":"job-123","status":"queued"}
```

GET /api/processing/:jobId

```json
{
  "jobId":"job-123",
  "status":"completed",
  "progress":100,
  "resultUrl":"/api/surveys/123/result"
}
```

## Results
GET /api/surveys/:id/result

Return:
- buildings
- roads
- parcels
- metrics
- validation issues
- processing metadata

## Parcels
GET /api/parcels/:id
PATCH /api/parcels/:id
POST /api/parcels/:id/verify
POST /api/parcels/:id/request-field-verification

## Exports
GET /api/surveys/:id/export/geojson
GET /api/surveys/:id/export/csv
GET /api/surveys/:id/report

## Error shape
```json
{
  "error": {
    "code": "INVALID_GEOSPATIAL_FILE",
    "message": "The uploaded file is not a valid georeferenced raster."
  }
}
```

Do not leak stack traces to clients.
