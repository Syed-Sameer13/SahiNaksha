import cv2
import numpy as np
from .geojson_service import feature_collection, polygon_feature, line_feature


def _load(image_path):
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Unable to read uploaded image.")
    return image


def _scale(point, width, height):
    x, y = point
    return [round((x / width) * 100, 2), round(100 - (y / height) * 100, 2)]


def _vegetation_mask(image):
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    b, g, r = cv2.split(image.astype(np.float32))
    excess_green = 2 * g - r - b
    hue_mask = cv2.inRange(hsv, np.array([30, 35, 20]), np.array([95, 255, 255]))
    exg_mask = (excess_green > 12).astype(np.uint8) * 255
    mask = cv2.bitwise_and(hue_mask, exg_mask)
    # Dilate slightly so tree edges and shadows do not become building outlines.
    return cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=1)


def _bbox_iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    if inter <= 0:
        return 0.0
    union = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - inter
    return inter / max(union, 1.0)


def _polygon_score(contour, approx, vegetation_ratio):
    area = max(float(cv2.contourArea(contour)), 1.0)
    perimeter = max(float(cv2.arcLength(contour, True)), 1.0)
    hull = cv2.convexHull(contour)
    hull_area = max(float(cv2.contourArea(hull)), 1.0)
    solidity = area / hull_area

    rect = cv2.minAreaRect(contour)
    rw, rh = rect[1]
    rect_area = max(rw * rh, 1.0)
    rectangularity = area / rect_area

    x, y, w, h = cv2.boundingRect(contour)
    extent = area / max(float(w * h), 1.0)
    compactness = min(1.0, (4.0 * np.pi * area) / (perimeter * perimeter))
    vertices = len(approx)

    # UAV tree contours are typically jagged. Roofs should remain geometrically simple.
    vertex_score = 1.0 if 4 <= vertices <= 10 else max(0.0, 1.0 - abs(vertices - 7) / 14.0)

    score = (
        0.30 * min(solidity, 1.0)
        + 0.28 * min(rectangularity, 1.0)
        + 0.16 * min(extent, 1.0)
        + 0.10 * compactness
        + 0.10 * vertex_score
        + 0.06 * (1.0 - vegetation_ratio)
    )

    return score, solidity, rectangularity, extent, compactness


def _extract_buildings(image):
    height, width = image.shape[:2]
    image_area = width * height

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)

    median = float(np.median(gray))
    low = int(max(25, 0.70 * median))
    high = int(min(220, max(low + 40, 1.35 * median)))
    edges = cv2.Canny(gray, low, high, apertureSize=3)

    vegetation = _vegetation_mask(image)
    edges[vegetation > 0] = 0

    # Close only tiny gaps. Large closing was one cause of merged/jagged candidates.
    edges = cv2.morphologyEx(
        edges,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)),
        iterations=1,
    )

    # External contours prevent nested edge fragments from becoming dozens of detections.
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    min_area = max(500.0, image_area * 0.0015)
    max_area = image_area * 0.055
    candidates = []

    for contour in contours:
        area = float(cv2.contourArea(contour))
        if not (min_area <= area <= max_area):
            continue

        perimeter = cv2.arcLength(contour, True)
        if perimeter <= 0:
            continue

        approx = cv2.approxPolyDP(contour, 0.020 * perimeter, True)
        if len(approx) < 4 or len(approx) > 10:
            continue

        x, y, bw, bh = cv2.boundingRect(contour)
        if bw < 22 or bh < 22:
            continue

        # Reject extremely thin structures: these are usually roads, shadows, or edge fragments.
        aspect = max(bw, bh) / max(min(bw, bh), 1)
        if aspect > 5.5:
            continue

        roi = vegetation[y:y + bh, x:x + bw]
        vegetation_ratio = float(cv2.countNonZero(roi)) / max(bw * bh, 1)
        if vegetation_ratio > 0.48:
            continue

        score, solidity, rectangularity, extent, compactness = _polygon_score(
            contour, approx, vegetation_ratio
        )

        # Strict quality gate: fewer candidates is preferable to a cluttered false-positive map.
        if solidity < 0.62 or rectangularity < 0.48 or extent < 0.28 or score < 0.62:
            continue

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

    candidates.sort(key=lambda item: item["score"], reverse=True)

    kept = []
    for candidate in candidates:
        if all(_bbox_iou(candidate["bbox"], other["bbox"]) < 0.35 for other in kept):
            kept.append(candidate)

    # A prototype should show only high-confidence structures rather than every weak contour.
    kept = kept[:15]

    buildings = []
    for index, candidate in enumerate(kept, start=1):
        points = [_scale(tuple(point[0]), width, height) for point in candidate["approx"]]
        if points[0] != points[-1]:
            points.append(points[0])

        building_id = f"B-{index:03d}"
        confidence = round(min(0.95, max(0.62, candidate["score"])), 2)
        buildings.append(
            polygon_feature(
                building_id,
                points,
                {
                    "building_id": building_id,
                    "confidence": confidence,
                    "pixel_area": round(candidate["area"], 1),
                    "solidity": round(candidate["solidity"], 2),
                    "rectangularity": round(candidate["rectangularity"], 2),
                    "extraction_method": "strict_high_confidence_cv",
                },
            )
        )

    return buildings, edges, vegetation


def _extract_roads(image, edges, vegetation, buildings):
    height, width = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    # Conservative road candidate mask: non-green, low-to-medium saturation, bright enough.
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]
    surface = ((sat < 95) & (val > 55) & (vegetation == 0)).astype(np.uint8) * 255
    surface = cv2.morphologyEx(
        surface,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)),
        iterations=1,
    )

    road_edges = cv2.bitwise_and(edges, surface)
    min_length = max(120, int(min(width, height) * 0.30))
    lines = cv2.HoughLinesP(
        road_edges,
        1,
        np.pi / 180,
        threshold=max(70, min_length // 2),
        minLineLength=min_length,
        maxLineGap=12,
    )

    if lines is None:
        return []

    roads = []
    candidates = []
    for x1, y1, x2, y2 in lines[:, 0, :].tolist():
        length = float(np.hypot(x2 - x1, y2 - y1))
        if length < min_length:
            continue

        # Reject border artifacts and near-vertical/horizontal image frame lines.
        border_distance = min(x1, y1, width - 1 - x1, height - 1 - y1, x2, y2, width - 1 - x2, height - 1 - y2)
        if border_distance < 8:
            continue

        candidates.append((length, x1, y1, x2, y2))

    candidates.sort(reverse=True)

    # Keep at most two very strong candidates. Do not draw uncertain road guesses.
    for index, (_, x1, y1, x2, y2) in enumerate(candidates[:2], start=1):
        road_id = f"R-{index:03d}"
        roads.append(
            line_feature(
                road_id,
                [_scale((x1, y1), width, height), _scale((x2, y2), width, height)],
                {
                    "road_id": road_id,
                    "confidence": 0.70,
                    "extraction_method": "strict_conservative_hough",
                },
            )
        )

    return roads


def _derive_parcels(buildings):
    # Do not invent legal parcel boundaries from a single RGB image.
    # Parcel delineation remains a human/GIS review task in this MVP.
    return []


def extract_features(image_path):
    image = _load(image_path)
    buildings, edges, vegetation = _extract_buildings(image)
    roads = _extract_roads(image, edges, vegetation, buildings)

    return {
        "buildings": feature_collection(buildings),
        "roads": feature_collection(roads),
        "parcels": feature_collection(_derive_parcels(buildings)),
    }
