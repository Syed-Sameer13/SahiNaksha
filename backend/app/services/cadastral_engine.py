import json
import cv2
import numpy as np
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from .geojson_service import feature_collection


def _scale_to_image(point, width, height):
    x, y = point
    return int(round(x * width / 100.0)), int(round((100.0 - y) * height / 100.0))


def _scale_from_image(point, width, height):
    x, y = point
    return [round(x * 100.0 / width, 3), round(100.0 - y * 100.0 / height, 3)]


def _edge_map(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    edges = cv2.Canny(gray, 45, 120)
    return cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)


def _snap_ring_to_evidence(ring, edges, width, height, radius=6):
    snapped = []
    moved = 0
    total = max(1, len(ring) - 1)

    for x, y in ring:
        px, py = _scale_to_image((x, y), width, height)
        x1, x2 = max(0, px - radius), min(width, px + radius + 1)
        y1, y2 = max(0, py - radius), min(height, py + radius + 1)
        patch = edges[y1:y2, x1:x2]
        ys, xs = np.where(patch > 0)

        if len(xs) == 0:
            snapped.append([x, y])
            continue

        xs = xs + x1
        ys = ys + y1
        distances = (xs - px) ** 2 + (ys - py) ** 2
        idx = int(np.argmin(distances))
        nx, ny = int(xs[idx]), int(ys[idx])

        if (nx - px) ** 2 + (ny - py) ** 2 <= radius * radius:
            snapped.append(_scale_from_image((nx, ny), width, height))
            if nx != px or ny != py:
                moved += 1
        else:
            snapped.append([x, y])

    if snapped and snapped[0] != snapped[-1]:
        snapped[-1] = snapped[0]
    return snapped, moved / total


def _validate_local_coordinates(geometry):
    coords = []
    if geometry.geom_type == "Polygon":
        coords = list(geometry.exterior.coords)
    elif geometry.geom_type == "MultiPolygon":
        for polygon in geometry.geoms:
            coords.extend(list(polygon.exterior.coords))
    if not coords:
        return False
    return all(-0.5 <= x <= 100.5 and -0.5 <= y <= 100.5 for x, y in coords)


def load_reference_parcels(reference_path, image_path):
    with open(reference_path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    features = payload.get("features", []) if payload.get("type") == "FeatureCollection" else [payload]
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Unable to read image for cadastral refinement.")
    height, width = image.shape[:2]
    edges = _edge_map(image)

    output = []
    index = 1

    for feature in features:
        geometry_data = feature.get("geometry")
        if not geometry_data:
            continue
        geometry = shape(geometry_data)
        if geometry.is_empty:
            continue
        if not geometry.is_valid:
            geometry = geometry.buffer(0)
        if geometry.is_empty:
            continue

        geometries = [geometry] if isinstance(geometry, Polygon) else list(geometry.geoms) if isinstance(geometry, MultiPolygon) else []
        for polygon in geometries:
            if not _validate_local_coordinates(polygon):
                raise ValueError(
                    "Reference parcel GeoJSON must use image-local normalized coordinates (0..100). "
                    "Geographic latitude/longitude requires orthorectified georeferencing, which this MVP input mode does not yet transform."
                )

            ring = [[float(x), float(y)] for x, y in polygon.exterior.coords]
            snapped_ring, evidence_ratio = _snap_ring_to_evidence(ring, edges, width, height)
            refined = Polygon(snapped_ring)
            if not refined.is_valid or refined.area <= 0.05:
                refined = polygon
                evidence_ratio = 0.0

            parcel_id = feature.get("properties", {}).get("parcel_id") or feature.get("properties", {}).get("id") or f"P-{index:03d}"
            props = {
                **feature.get("properties", {}),
                "parcel_id": str(parcel_id),
                "status": "Preliminary cadastral parcel",
                "source": "existing_gis_refined_with_drone_edge_evidence",
                "boundary_evidence": round(float(evidence_ratio), 2),
                "review_required": True,
            }
            output.append({
                "type": "Feature",
                "geometry": mapping(refined),
                "properties": props,
            })
            index += 1

    return feature_collection(output)


def classify_parcel_landuse(parcels, image_path):
    image = cv2.imread(image_path)
    if image is None:
        return parcels
    height, width = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    green = cv2.inRange(hsv, np.array([30, 35, 20]), np.array([95, 255, 255]))

    for feature in parcels.get("features", []):
        geometry = shape(feature["geometry"])
        mask = np.zeros((height, width), dtype=np.uint8)
        pts = []
        for x, y in geometry.exterior.coords:
            pts.append(_scale_to_image((x, y), width, height))
        if len(pts) < 3:
            continue
        cv2.fillPoly(mask, [np.array(pts, dtype=np.int32)], 255)
        area = max(1, cv2.countNonZero(mask))
        green_ratio = cv2.countNonZero(cv2.bitwise_and(mask, green)) / area
        if green_ratio > 0.60:
            land_use = "Vegetated/Open"
        elif green_ratio < 0.18:
            land_use = "Built-up"
        else:
            land_use = "Mixed Urban"
        feature.setdefault("properties", {})["land_use"] = land_use
        feature["properties"]["vegetation_ratio"] = round(float(green_ratio), 2)

    return parcels


def classify_parcel_height(parcels, dsm_path):
    """Attach relative height evidence from an aligned DSM/height raster."""
    dsm = cv2.imread(dsm_path, cv2.IMREAD_GRAYSCALE)
    if dsm is None:
        return parcels
    height, width = dsm.shape[:2]

    for feature in parcels.get("features", []):
        geometry = shape(feature["geometry"])
        mask = np.zeros((height, width), dtype=np.uint8)
        pts = [_scale_to_image((x, y), width, height) for x, y in geometry.exterior.coords]
        if len(pts) < 3:
            continue
        cv2.fillPoly(mask, [np.array(pts, dtype=np.int32)], 255)
        values = dsm[mask > 0]
        if len(values):
            feature.setdefault("properties", {})["relative_height_mean"] = round(float(np.mean(values)), 2)
            feature["properties"]["height_source"] = "aligned_dsm"
    return parcels
