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
    return [round((x / width) * 100, 2), round((y / height) * 100, 2)]

def extract_features(image_path):
    image = _load(image_path)
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    edges = cv2.Canny(blurred, 60, 160)
    kernel = np.ones((3, 3), np.uint8)
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    buildings = []
    parcels = []
    min_area = max(120, (width * height) * 0.00015)
    building_index = 1

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area:
            continue
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(approx) < 4:
            continue
        x, y, w, h = cv2.boundingRect(approx)
        if w < 10 or h < 10:
            continue
        points = [_scale(tuple(p[0]), width, height) for p in approx]
        points.append(points[0])
        building_id = f"B-{building_index:03d}"
        confidence = min(0.95, round(0.45 + area / (width * height), 2))
        buildings.append(polygon_feature(building_id, points, {"building_id": building_id, "pixel_area": round(float(area), 1), "confidence": confidence, "extraction_method": "opencv_contour"}))
        building_index += 1

    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=max(30, width // 12), minLineLength=max(30, width // 10), maxLineGap=max(10, width // 40))
    roads = []
    if lines is not None:
        ranked = sorted(lines[:, 0, :].tolist(), key=lambda l: (l[2]-l[0])**2 + (l[3]-l[1])**2, reverse=True)
        for index, (x1, y1, x2, y2) in enumerate(ranked[:12], start=1):
            roads.append(line_feature(f"R-{index:03d}", [_scale((x1,y1), width,height), _scale((x2,y2), width,height)], {"road_id": f"R-{index:03d}", "extraction_method": "opencv_hough"}))

    parcels = _derive_parcels(buildings)
    return {"buildings": feature_collection(buildings), "roads": feature_collection(roads), "parcels": feature_collection(parcels)}

def _derive_parcels(buildings):
    if not buildings:
        return []
    xs, ys = [], []
    for feature in buildings:
        for x, y in feature["geometry"]["coordinates"][0][:-1]:
            xs.append(x); ys.append(y)
    if not xs:
        return []
    margin = 3
    polygon = [[max(0,min(xs)-margin), max(0,min(ys)-margin)], [min(100,max(xs)+margin), max(0,min(ys)-margin)], [min(100,max(xs)+margin), min(100,max(ys)+margin)], [max(0,min(xs)-margin), min(100,max(ys)+margin)]]
    polygon.append(polygon[0])
    return [polygon_feature("P-001", polygon, {"parcel_id":"P-001","quality_score":70,"status":"Preliminary","review_required":True,"extraction_method":"building_extent"})]
