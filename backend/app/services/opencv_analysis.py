import cv2
import numpy as np
from .geojson_service import feature_collection, polygon_feature, line_feature


def _load(image_path):
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Unable to read uploaded image.")
    return image


def _scale(point, width, height):
    # Leaflet CRS.Simple uses an upward-positive Y axis. OpenCV image Y grows downward.
    x, y = point
    return [round((x / width) * 100, 2), round(100 - (y / height) * 100, 2)]


def _polygon_area(points):
    if len(points) < 3:
        return 0.0
    value = 0.0
    for i in range(len(points)):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % len(points)]
        value += x1 * y2 - x2 * y1
    return abs(value) / 2.0


def _vegetation_mask(image):
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    b, g, r = cv2.split(image.astype(np.float32))
    excess_green = 2 * g - r - b
    green_hue = cv2.inRange(hsv, np.array([32, 40, 20]), np.array([95, 255, 255]))
    green_index = (excess_green > 8).astype(np.uint8) * 255
    return cv2.bitwise_and(green_hue, green_index)


def _bbox_iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    if inter <= 0:
        return 0.0
    union = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - inter
    return inter / max(union, 1)


def _dedupe(candidates):
    candidates = sorted(candidates, key=lambda item: item["score"], reverse=True)
    kept = []
    for candidate in candidates:
        if all(_bbox_iou(candidate["bbox"], other["bbox"]) < 0.55 for other in kept):
            kept.append(candidate)
    return kept


def _extract_buildings(image):
    height, width = image.shape[:2]
    image_area = width * height
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    filtered = cv2.bilateralFilter(gray, 7, 55, 55)

    median = float(np.median(filtered))
    low = int(max(20, 0.66 * median))
    high = int(min(220, max(low + 35, 1.33 * median)))
    edges = cv2.Canny(filtered, low, high)

    # Small closing reconnects roof edges without merging neighbouring buildings.
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=1)
    vegetation = _vegetation_mask(image)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    min_area = max(180.0, image_area * 0.0007)
    max_area = image_area * 0.10
    candidates = []

    for contour in contours:
        area = float(cv2.contourArea(contour))
        if area < min_area or area > max_area:
            continue

        perimeter = cv2.arcLength(contour, True)
        if perimeter <= 0:
            continue
        approx = cv2.approxPolyDP(contour, 0.012 * perimeter, True)
        if len(approx) < 4 or len(approx) > 24:
            continue

        x, y, bw, bh = cv2.boundingRect(contour)
        if bw < 12 or bh < 12:
            continue

        hull = cv2.convexHull(contour)
        hull_area = max(float(cv2.contourArea(hull)), 1.0)
        solidity = area / hull_area

        rect = cv2.minAreaRect(contour)
        rect_area = max(rect[1][0] * rect[1][1], 1.0)
        rectangularity = area / rect_area
        extent = area / max(float(bw * bh), 1.0)

        roi_vegetation = vegetation[y:y + bh, x:x + bw]
        vegetation_ratio = float(cv2.countNonZero(roi_vegetation)) / max(bw * bh, 1)

        # Buildings tend to have compact, closed, non-vegetated boundaries.
        if solidity < 0.45 or rectangularity < 0.28 or vegetation_ratio > 0.72:
            continue

        score = (
            0.34 * min(solidity, 1.0)
            + 0.30 * min(rectangularity, 1.0)
            + 0.20 * min(extent, 1.0)
            + 0.16 * (1.0 - vegetation_ratio)
        )

        candidates.append({
            "contour": contour,
            "approx": approx,
            "bbox": (x, y, x + bw, y + bh),
            "score": score,
            "area": area,
            "solidity": solidity,
            "rectangularity": rectangularity,
            "vegetation_ratio": vegetation_ratio,
        })

    candidates = _dedupe(candidates)
    buildings = []

    for index, candidate in enumerate(candidates, start=1):
        points = [_scale(tuple(point[0]), width, height) for point in candidate["approx"]]
        if len(points) < 3:
            continue
        if points[0] != points[-1]:
            points.append(points[0])

        building_id = f"B-{index:03d}"
        confidence = round(min(0.96, max(0.50, candidate["score"])), 2)
        buildings.append(
            polygon_feature(
                building_id,
                points,
                {
                    "building_id": building_id,
                    "pixel_area": round(candidate["area"], 1),
                    "confidence": confidence,
                    "solidity": round(candidate["solidity"], 2),
                    "rectangularity": round(candidate["rectangularity"], 2),
                    "extraction_method": "opencv_adaptive_building_candidate",
                },
            )
        )

    return buildings, edges, vegetation


def _line_support(mask, x1, y1, x2, y2):
    sample_count = max(2, int(np.hypot(x2 - x1, y2 - y1)))
    xs = np.linspace(x1, x2, sample_count).astype(np.int32)
    ys = np.linspace(y1, y2, sample_count).astype(np.int32)
    xs = np.clip(xs, 0, mask.shape[1] - 1)
    ys = np.clip(ys, 0, mask.shape[0] - 1)
    return float(np.mean(mask[ys, xs] > 0))


def _extract_roads(image, edges, vegetation, buildings):
    height, width = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    # Restrict Hough detection to non-vegetated, moderately low-saturation surfaces.
    low_saturation = cv2.inRange(hsv, np.array([0, 0, 25]), np.array([179, 125, 245]))
    non_vegetation = cv2.bitwise_not(vegetation)
    surface_mask = cv2.bitwise_and(low_saturation, non_vegetation)
    surface_mask = cv2.morphologyEx(
        surface_mask,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9)),
        iterations=1,
    )

    road_edges = cv2.bitwise_and(edges, surface_mask)
    min_length = max(55, int(min(width, height) * 0.18))
    lines = cv2.HoughLinesP(
        road_edges,
        1,
        np.pi / 180,
        threshold=max(32, min_length // 2),
        minLineLength=min_length,
        maxLineGap=max(12, min_length // 3),
    )

    building_boxes = []
    for feature in buildings:
        coords = feature["geometry"]["coordinates"][0][:-1]
        # Coordinates are normalized; convert back to image coordinates.
        xs = [p[0] * width / 100 for p in coords]
        ys = [(100 - p[1]) * height / 100 for p in coords]
        building_boxes.append((min(xs), min(ys), max(xs), max(ys)))

    roads = []
    if lines is None:
        return roads

    candidates = []
    for x1, y1, x2, y2 in lines[:, 0, :].tolist():
        length = float(np.hypot(x2 - x1, y2 - y1))
        support = _line_support(surface_mask, x1, y1, x2, y2)
        if length < min_length or support < 0.72:
            continue

        midpoint = ((x1 + x2) / 2, (y1 + y2) / 2)
        inside_building = any(
            bx1 <= midpoint[0] <= bx2 and by1 <= midpoint[1] <= by2
            for bx1, by1, bx2, by2 in building_boxes
        )
        if inside_building:
            continue

        candidates.append((length, support, x1, y1, x2, y2))

    # Keep only the strongest, spatially distinct road candidates.
    candidates.sort(reverse=True)
    for index, (_, support, x1, y1, x2, y2) in enumerate(candidates[:6], start=1):
        road_id = f"R-{index:03d}"
        roads.append(
            line_feature(
                road_id,
                [_scale((x1, y1), width, height), _scale((x2, y2), width, height)],
                {
                    "road_id": road_id,
                    "confidence": round(min(0.90, 0.45 + support * 0.45), 2),
                    "extraction_method": "opencv_surface_supported_hough",
                },
            )
        )

    return roads


def _derive_parcels(buildings):
    parcels = []
    for index, building in enumerate(buildings, start=1):
        coords = building["geometry"]["coordinates"][0][:-1]
        if len(coords) < 3:
            continue

        xs = [point[0] for point in coords]
        ys = [point[1] for point in coords]
        margin = max(2.0, min(6.0, (max(xs) - min(xs) + max(ys) - min(ys)) * 0.10))

        x1 = max(0.0, min(xs) - margin)
        y1 = max(0.0, min(ys) - margin)
        x2 = min(100.0, max(xs) + margin)
        y2 = min(100.0, max(ys) + margin)
        polygon = [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]

        parcel_id = f"P-{index:03d}"
        parcels.append(
            polygon_feature(
                parcel_id,
                polygon,
                {
                    "parcel_id": parcel_id,
                    "source_building": building["properties"]["building_id"],
                    "quality_score": 45,
                    "status": "Preliminary Context Candidate",
                    "review_required": True,
                    "extraction_method": "building_context_extent",
                },
            )
        )
    return parcels


def extract_features(image_path):
    image = _load(image_path)
    buildings, edges, vegetation = _extract_buildings(image)
    roads = _extract_roads(image, edges, vegetation, buildings)
    parcels = _derive_parcels(buildings)

    return {
        "buildings": feature_collection(buildings),
        "roads": feature_collection(roads),
        "parcels": feature_collection(parcels),
    }
