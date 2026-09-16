"""HOTOSM DINOv3 building-footprint inference plus road/block evidence."""
from __future__ import annotations

import os
from pathlib import Path

import cv2
import numpy as np

from .geojson_service import feature_collection

MODEL_DEFAULT = Path(__file__).resolve().parents[2] / "models" / "hotosm_dinov3s_buildings.onnx"
MODEL_SIZE = 256
STRIDE_DEFAULT = 192
THRESHOLD_DEFAULT = 0.4371
MEAN = np.array([0.4296737853453577, 0.4001659668453235, 0.34333372802741474], dtype=np.float32)
STD = np.array([0.2056069389373208, 0.16738555558380538, 0.1598986422586595], dtype=np.float32)

_SESSION = None
_SESSION_PATH = None


def model_path() -> Path:
    return Path(os.getenv("SAHINAKSHA_HOTOSM_MODEL", str(MODEL_DEFAULT)))


def _session():
    global _SESSION, _SESSION_PATH
    path = model_path()
    if not path.exists() or path.stat().st_size < 100_000_000:
        return None, f"HOTOSM model missing: {path}"
    if _SESSION is not None and _SESSION_PATH == str(path):
        return _SESSION, "ready"
    try:
        import onnxruntime as ort
        providers = ["CPUExecutionProvider"]
        if "CUDAExecutionProvider" in ort.get_available_providers():
            providers.insert(0, "CUDAExecutionProvider")
        _SESSION = ort.InferenceSession(str(path), providers=providers)
        _SESSION_PATH = str(path)
        return _SESSION, "ready"
    except Exception as exc:
        return None, f"HOTOSM model unavailable: {exc}"


def _prepare(tile: np.ndarray) -> np.ndarray:
    if tile.shape[:2] != (MODEL_SIZE, MODEL_SIZE):
        tile = cv2.resize(tile, (MODEL_SIZE, MODEL_SIZE), interpolation=cv2.INTER_AREA)
    rgb = cv2.cvtColor(tile, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    rgb = (rgb - MEAN) / STD
    return np.transpose(rgb, (2, 0, 1))[None, ...].astype(np.float32)


def _predict_tile(session, tile: np.ndarray) -> np.ndarray:
    input_name = session.get_inputs()[0].name
    output = np.asarray(session.run(None, {input_name: _prepare(tile)})[0])
    if output.ndim == 4:
        logits = output[:, 0]
    elif output.ndim == 3:
        logits = output
    else:
        raise RuntimeError(f"Unexpected HOTOSM ONNX output shape: {output.shape}")
    return 1.0 / (1.0 + np.exp(-np.clip(logits[0], -30, 30)))


def _windows(height: int, width: int, stride: int):
    max_x = max(width - MODEL_SIZE, 0)
    max_y = max(height - MODEL_SIZE, 0)
    xs = list(range(0, max_x + 1, stride)) or [0]
    ys = list(range(0, max_y + 1, stride)) or [0]
    if xs[-1] != max_x:
        xs.append(max_x)
    if ys[-1] != max_y:
        ys.append(max_y)
    return [(x, y) for y in ys for x in xs]


def _polygon_features(mask: np.ndarray, width: int, height: int, prefix: str, feature_type: str, min_area: int = 150):
    binary = (mask.astype(np.uint8) * 255)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    features = []
    for idx, contour in enumerate(contours, 1):
        area = cv2.contourArea(contour)
        if area < min_area:
            continue
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, max(1.0, 0.008 * perimeter), True)
        if len(approx) < 4:
            continue
        points = []
        for p in approx[:, 0, :]:
            x, y = float(p[0]), float(p[1])
            points.append([round(x * 100.0 / width, 3), round(100.0 - y * 100.0 / height, 3)])
        if points[0] != points[-1]:
            points.append(points[0])
        if len(points) < 4:
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [points]},
            "properties": {
                f"{prefix}_id": f"{prefix[0].upper()}-{idx:03d}",
                "feature_type": feature_type,
                "review_required": True,
            },
        })
    return feature_collection(features)


def _building_geojson(mask: np.ndarray, width: int, height: int):
    fc = _polygon_features(mask, width, height, "building", "building_footprint", min_area=150)
    for f in fc["features"]:
        f["properties"].update({"confidence": "model_thresholded", "source_model": "hotosm/dinov3s-buildings"})
    return fc


def _road_mask(image: np.ndarray, building_mask: np.ndarray) -> np.ndarray:
    """Conservative RGB road/asphalt evidence; parking may also be included."""
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    neutral = ((s < 95) & (v > 55) & (v < 205)).astype(np.uint8) * 255
    dark_neutral = ((s < 120) & (gray > 45) & (gray < 185)).astype(np.uint8) * 255
    mask = cv2.bitwise_or(neutral, dark_neutral)
    vegetation = ((h >= 28) & (h <= 100) & (s > 45) & (v > 35)).astype(np.uint8) * 255
    mask[vegetation > 0] = 0
    building = cv2.dilate((building_mask.astype(np.uint8) * 255), np.ones((7, 7), np.uint8), iterations=1)
    mask[building > 0] = 0
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8), iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)
    h_img, w_img = mask.shape
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    cleaned = np.zeros_like(mask)
    min_area = max(250, int(h_img * w_img * 0.00025))
    for label in range(1, n):
        area = stats[label, cv2.CC_STAT_AREA]
        w = stats[label, cv2.CC_STAT_WIDTH]
        h = stats[label, cv2.CC_STAT_HEIGHT]
        elongation = max(w, h) / max(1, min(w, h))
        if area >= min_area and (elongation >= 2.0 or area >= min_area * 4):
            cleaned[labels == label] = 255
    return cleaned > 0


def _road_geojson(mask: np.ndarray, width: int, height: int):
    fc = _polygon_features(mask, width, height, "road", "road_evidence", min_area=max(250, int(width * height * 0.0003)))
    for f in fc["features"]:
        f["properties"].update({"confidence": "heuristic_evidence", "source": "rgb_asphalt_road_extractor"})
    return fc


def _preliminary_blocks(road_mask: np.ndarray, building_mask: np.ndarray, width: int, height: int):
    """Create non-authoritative land blocks separated by detected road corridors."""
    separator = cv2.dilate((road_mask.astype(np.uint8) * 255), np.ones((17, 17), np.uint8), iterations=1)
    separator = cv2.bitwise_or(separator, cv2.dilate((building_mask.astype(np.uint8) * 255), np.ones((3, 3), np.uint8), iterations=1))
    land = np.where(separator > 0, 0, 255).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(land, 8)
    blocks = np.zeros_like(land)
    min_area = max(1200, int(width * height * 0.002))
    for label in range(1, n):
        area = stats[label, cv2.CC_STAT_AREA]
        touches_edge = (
            stats[label, cv2.CC_STAT_LEFT] == 0 or stats[label, cv2.CC_STAT_TOP] == 0 or
            stats[label, cv2.CC_STAT_LEFT] + stats[label, cv2.CC_STAT_WIDTH] >= width or
            stats[label, cv2.CC_STAT_TOP] + stats[label, cv2.CC_STAT_HEIGHT] >= height
        )
        if area >= min_area and not touches_edge:
            blocks[labels == label] = 1
    fc = _polygon_features(blocks, width, height, "parcel", "preliminary_parcel_block", min_area=min_area)
    for f in fc["features"]:
        f["properties"].update({"confidence": "heuristic_block", "legal_boundary": False, "review_required": True})
    return fc


def run_hotosm_building_segmentation(image_path: str):
    session, status = _session()
    if session is None:
        return None, {"provider": "hotosm_dinov3s_buildings", "status": status}
    image = cv2.imread(image_path)
    if image is None:
        return None, {"provider": "hotosm_dinov3s_buildings", "status": "unable to read image"}
    height, width = image.shape[:2]
    stride = int(os.getenv("SAHINAKSHA_HOTOSM_STRIDE", str(STRIDE_DEFAULT)))
    threshold = float(os.getenv("SAHINAKSHA_HOTOSM_THRESHOLD", str(THRESHOLD_DEFAULT)))
    probability = np.zeros((height, width), dtype=np.float32)
    weights = np.zeros((height, width), dtype=np.float32)
    windows = _windows(height, width, stride)
    for x, y in windows:
        crop = image[y:min(y + MODEL_SIZE, height), x:min(x + MODEL_SIZE, width)]
        actual_h, actual_w = crop.shape[:2]
        if actual_h < MODEL_SIZE or actual_w < MODEL_SIZE:
            padded = np.zeros((MODEL_SIZE, MODEL_SIZE, 3), dtype=np.uint8)
            padded[:actual_h, :actual_w] = crop
            tile = padded
        else:
            tile = crop
        tile_prob = _predict_tile(session, tile)
        probability[y:y + actual_h, x:x + actual_w] += tile_prob[:actual_h, :actual_w]
        weights[y:y + actual_h, x:x + actual_w] += 1.0
    probability /= np.maximum(weights, 1.0)
    building_mask = probability >= threshold
    buildings = _building_geojson(building_mask, width, height)
    roads_mask = _road_mask(image, building_mask)
    roads = _road_geojson(roads_mask, width, height)
    parcels = _preliminary_blocks(roads_mask, building_mask, width, height)
    return {"buildings": buildings, "roads": roads, "parcels": parcels}, {
        "provider": "hotosm_dinov3s_buildings", "status": "ready", "threshold": threshold,
        "stride": stride, "windows": len(windows), "accepted_buildings": len(buildings["features"]),
        "accepted_roads": len(roads["features"]), "preliminary_parcel_blocks": len(parcels["features"]),
        "parcel_mode": "preliminary_blocks_not_legal_cadastre", "model": str(model_path()),
    }
