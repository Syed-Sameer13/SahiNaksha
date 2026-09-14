from shapely.geometry import shape

def validate_parcels(feature_collection):
    features = feature_collection.get("features", [])
    valid_count = invalid_count = overlap_count = noise_count = 0
    issues = []
    geometries = []

    for feature in features:
        feature_id = feature.get("properties", {}).get("parcel_id", "unknown")
        try:
            geometry = shape(feature["geometry"])
            if geometry.is_empty or geometry.area <= 0 or not geometry.is_valid:
                invalid_count += 1
                issues.append({"feature_id": feature_id, "type": "invalid_geometry", "message": "Parcel geometry is invalid."})
                continue
            if geometry.area < 25:
                noise_count += 1
                issues.append({"feature_id": feature_id, "type": "noise_candidate", "message": "Feature is too small and should be reviewed."})
            valid_count += 1
            geometries.append((feature_id, geometry))
        except Exception as exc:
            invalid_count += 1
            issues.append({"feature_id": feature_id, "type": "parse_error", "message": str(exc)})

    for i, (left_id, left) in enumerate(geometries):
        for right_id, right in geometries[i + 1:]:
            intersection = left.intersection(right)
            if not intersection.is_empty and intersection.area > 0.001:
                overlap_count += 1
                issues.append({"feature_id": f"{left_id} / {right_id}", "type": "overlap", "message": "Parcel candidates overlap and require human review."})

    return {"valid_count": valid_count, "invalid_count": invalid_count, "overlap_count": overlap_count, "noise_count": noise_count, "issues": issues}
