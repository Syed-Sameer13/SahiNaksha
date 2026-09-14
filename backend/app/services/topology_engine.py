from shapely.geometry import shape, mapping
from .geojson_service import feature_collection


def repair_and_validate_parcels(parcels):
    accepted = []
    repaired_count = 0
    overlap_count = 0

    features = sorted(
        parcels.get("features", []),
        key=lambda f: shape(f["geometry"]).area if f.get("geometry") else 0,
        reverse=True,
    )

    for feature in features:
        geom = shape(feature["geometry"])
        if geom.is_empty:
            continue
        if not geom.is_valid:
            geom = geom.buffer(0)
            repaired_count += 1
        if geom.is_empty or geom.area <= 0.02:
            continue

        for existing in accepted:
            existing_geom = shape(existing["geometry"])
            if geom.intersects(existing_geom):
                overlap = geom.intersection(existing_geom).area
                if overlap > 0.02:
                    overlap_count += 1
                    geom = geom.difference(existing_geom)
                    repaired_count += 1
                    if geom.is_empty:
                        break

        if geom.is_empty:
            continue

        if geom.geom_type == "MultiPolygon":
            parts = [p for p in geom.geoms if p.area > 0.02]
        else:
            parts = [geom]

        for part in parts:
            props = dict(feature.get("properties", {}))
            props["topology_repaired"] = True if repaired_count else False
            accepted.append({"type": "Feature", "geometry": mapping(part), "properties": props})

    return feature_collection(accepted), {
        "repaired_geometries": repaired_count,
        "overlap_conflicts_resolved": overlap_count,
    }
