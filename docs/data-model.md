# Data Model

## projects
- id
- name
- location
- description
- created_by
- status
- created_at

## surveys
- id
- project_id
- input_file_url
- file_type
- crs
- bounds
- processing_status
- created_at

## parcels
- id
- project_id
- parcel_code
- land_use
- area_sq_m
- confidence_score
- status
- source
- geometry
- created_at
- updated_at

Suggested status:
candidate, review, verified, rejected, field_verification

## buildings
- id
- project_id
- area_sq_m
- confidence_score
- source
- geometry

## roads
- id
- project_id
- feature_type
- width_estimate_m
- confidence_score
- geometry

## validation_issues
- id
- project_id
- parcel_id
- issue_type
- severity
- description
- resolved
- created_at

Issue examples:
overlap, gap, self_intersection, invalid_geometry, area_mismatch, outside_reference, building_outside_parcel

## Spatial notes
Keep source CRS metadata. Use a suitable projected CRS for distance/area calculations. Keep source/reference geometries separate from AI-derived geometries.
