"""HOTOSM DINOv3 building-footprint inference for SahiNaksha.

Uses the public HOTOSM `dinov3s-buildings` ONNX model. The model is a
building-specific semantic segmentation model for very-high-resolution aerial
imagery. It expects 256x256 RGB windows and outputs building logits.
"""
from __future__ import annotations

import os
from pathlib import Path

import cv2
import numpy as np

from .geojson_service import feature_collection

MODEL_DEFAULT = Path(__file__).resolve().parents[../../] / "models" / "hotosm_dinov3s_buildings.onnx"
MODEL_URL = "https://huggingface.co/hotosm/dinov3s-buildings/resolve/main/model.onnx?download=true"
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
    output = session.run(None, {input_name: _prepare(tile)})[0]
    output = np.asarray(output)
    if output.ndim == 4:
        # Reference implementation uses logits[:, 0] as the building channel.
        logits = output[:, 0]
    elif output.ndim == 3:
        logits = output
    else:
        raise RuntimeError(f"Unexpected HOTOSM ONNX output shape: {output.shape}")
    return 1.0 / (1.0 + np.exp(-np.clip(logits[0], -30, 30)))


def _windows(height: int, width: int, stride: int):
    xs = list(range(0, max(width - MODEL_SIZE, 0) + 1, stride))
    ys = list(range(0, max(height - MODEL_SIZE, 0) + 1, stride))
    if not xs or xs[-1] != max(width - MODEL_SIZE, 0):
        xs.append(max(width - MODEL_SIZE, 0))
    if not ys or ys[-1] != max(height - MODEL_SIZE, 0):
        ys.append(max(height - MODEL_SIZE, 0))
    return [(x, y) for y in ys for x in xs]


def _to_geojson(mask: np.ndarray, width: int, height: int, min_area: int = 150):
    mask = (mask.astype(np.uint8) * 255)
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
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
                "building_id": f"B-{idx:03d}",
                "feature_type": "building_footprint",
                "confidence": "model_thresholded",
                "review_required": True,
                "source_model": "hotosm/dinov3s-buildings",
            },
        })
    return feature_collection(features)


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

    for x, y in _windows(height, width, stride):
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
    mask = probability >= threshold
    buildings = _to_geojson(mask, width, height)

    return {"buildings": buildings, "roads": feature_collection([]), "parcels": feature_collection([])}, {
        "provider": "hotosm_dinov3s_buildings",
        "status": "ready",
        "threshold": threshold,
        "stride": stride,
        "windows": len(_windows(height, width, stride)),
        "accepted_buildings": len(buildings["features"]),
        "model": str(model_path()),
    }
