import os
import cv2
import numpy as np
from shapely.geometry import Polygon
from .geojson_service import feature_collection


def _scale(point, width, height):
    x, y = point
    return [round(x * 100.0 / width, 3), round(100.0 - y * 100.0 / height, 3)]


def _vegetation_mask(image):
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    b, g, r = cv2.split(image.astype(np.float32))
    exg = 2 * g - r - b
    hue = cv2.inRange(hsv, np.array([30, 35, 20]), np.array([95, 255, 255]))
    return cv2.bitwise_and(hue, (exg > 8).astype(np.uint8) * 255)


def _sam_generator():
    if os.getenv("SAHINAKSHA_ENABLE_SAM", "0") != "1":
        return None, "SAM disabled"

    checkpoint = os.getenv("SAHINAKSHA_SAM_CHECKPOINT")
    model_type = os.getenv("SAHINAKSHA_SAM_MODEL_TYPE", "vit_b")
    if not checkpoint or not os.path.exists(checkpoint):
        return None, "SAM checkpoint not configured"

    try:
        from segment_anything import sam_model_registry, SamAutomaticMaskGenerator
        model = sam_model_registry[model_type](checkpoint=checkpoint)
        generator = SamAutomaticMaskGenerator(
            model=model,
            points_per_side=24,
            pred_iou_thresh=0.88,
            stability_score_thresh=0.92,
            crop_n_layers=1,
            crop_n_points_downscale_factor=2,
            min_mask_region_area=500,
        )
        return generator, "SAM"
    except Exception as exc:
        return None, f"SAM unavailable: {exc}"


def _mask_features(image, masks):
    height, width = image.shape[:2]
    vegetation = _vegetation_mask(image)
    image_area = width * height
    building = []
    roads = []
    boundaries = np.zeros((height, width), dtype=np.uint8)

    for item in masks:
        mask = item["segmentation"].astype(np.uint8) * 255
        area = int(item.get("area", cv2.countNonZero(mask)))
        if area < max(600, image_area * 0.001) or area > image_area * 0.25:
            continue

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        contour = max(contours, key=cv2.contourArea)
        contour_area = cv2.contourArea(contour)
        if contour_area < 500:
            continue

        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.012 * perimeter, True)
        if len(approx) < 3:
            continue

        x, y, bw, bh = cv2.boundingRect(contour)
        aspect = max(bw, bh) / max(1, min(bw, bh))
        vegetation_ratio = cv2.countNonZero(cv2.bitwise_and(mask, vegetation)) / max(area, 1)

        hull = cv2.convexHull(contour)
        solidity = contour_area / max(cv2.contourArea(hull), 1)
        rect = cv2.minAreaRect(contour)
        rectangularity = contour_area / max(rect[1][0] * rect[1][1], 1)
        score = 0.45 * float(item.get("predicted_iou", 0.5)) + 0.35 * float(item.get("stability_score", 0.5)) + 0.20 * min(solidity, 1.0)

        cv2.drawContours(boundaries, [contour], -1, 255, 1)

        coords = [_scale(tuple(p[0]), width, height) for p in approx]
        if coords[0] != coords[-1]:
            coords.append(coords[0])

        props = {
            "confidence": round(min(0.99, score), 2),
            "model": "segment_anything",
            "mask_area_pixels": area,
            "vegetation_ratio": round(float(vegetation_ratio), 2),
            "solidity": round(float(solidity), 2),
        }

        if aspect > 4.5 and area > image_area * 0.004:
            roads.append({
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [coords]},
                "properties": {**props, "road_id": f"R-{len(roads)+1:03d}", "feature_type": "access_corridor"},
            })
        elif vegetation_ratio < 0.45 and rectangularity > 0.32 and score >= 0.62:
            building.append({
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [coords]},
                "properties": {**props, "building_id": f"B-{len(building)+1:03d}", "feature_type": "building_footprint"},
            })

    building.sort(key=lambda f: f["properties"]["confidence"], reverse=True)
    roads.sort(key=lambda f: f["properties"]["confidence"], reverse=True)
    return feature_collection(building[:30]), feature_collection(roads[:15]), boundaries


def _parcel_candidates_from_boundaries(image, boundary_map):
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 45, 120)
    barriers = cv2.bitwise_or(boundary_map, edges)
    barriers = cv2.dilate(barriers, np.ones((3, 3), np.uint8), iterations=1)
    free = cv2.bitwise_not(barriers)

    count, labels, stats, _ = cv2.connectedComponentsWithStats(free, connectivity=8)
    image_area = width * height
    parcels = []

    for label in range(1, count):
        x, y, bw, bh, area = stats[label]
        if area < image_area * 0.008 or area > image_area * 0.20:
            continue
        if x <= 1 or y <= 1 or x + bw >= width - 1 or y + bh >= height - 1:
            continue

        component = (labels == label).astype(np.uint8) * 255
        contours, _ = cv2.findContours(component, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue
        contour = max(contours, key=cv2.contourArea)
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.008 * perimeter, True)
        if len(approx) < 3:
            continue

        coords = [_scale(tuple(p[0]), width, height) for p in approx]
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        polygon = Polygon(coords)
        if not polygon.is_valid or polygon.area < 0.05:
            continue

        evidence = min(0.85, 0.40 + min(0.40, perimeter / max(1.0, np.sqrt(image_area) * 6)))
        parcels.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [coords]},
            "properties": {
                "parcel_id": f"AI-P-{len(parcels)+1:03d}",
                "confidence": round(float(evidence), 2),
                "status": "AI preliminary parcel candidate",
                "source": "sam_boundary_and_image_partition",
                "review_required": True,
            },
        })

    parcels.sort(key=lambda f: f["properties"]["confidence"], reverse=True)
    return feature_collection(parcels[:40])


def run_ai_segmentation(image_path):
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Unable to read image for AI segmentation.")

    generator, status = _sam_generator()
    if generator is None:
        return None, {"provider": "none", "status": status}

    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    masks = generator.generate(rgb)
    buildings, roads, boundaries = _mask_features(image, masks)
    parcels = _parcel_candidates_from_boundaries(image, boundaries)

    return {
        "buildings": buildings,
        "roads": roads,
        "parcels": parcels,
    }, {
        "provider": "segment_anything",
        "status": "ready",
        "raw_masks": len(masks),
    }
