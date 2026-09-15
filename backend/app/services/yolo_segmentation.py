"""Custom YOLO segmentation inference for the SahiNaksha demo.

Loads backend/models/sahinaksha_seg.pt when present. The model is expected to
use class 0=building and class 1=road. Output polygons are in image-local
0..100 coordinates so the existing WebGIS can display them.
"""
from __future__ import annotations

import os
from pathlib import Path

import cv2


def _model_path() -> Path:
    return Path(os.getenv("SAHINAKSHA_YOLO_MODEL", str(Path(__file__).resolve().parents[2] / "models" / "sahinaksha_seg.pt")))


def _poly(points, width: int, height: int):
    coords = []
    for x, y in points:
        coords.append([round(float(x) * 100 / width, 3), round(100 - float(y) * 100 / height, 3)])
    if coords and coords[0] != coords[-1]:
        coords.append(coords[0])
    return coords


def run_yolo_segmentation(image_path: str):
    path = _model_path()
    if not path.exists():
        return None, {"provider": "custom_yolo", "status": f"model not found: {path}"}
    try:
        from ultralytics import YOLO
    except Exception as exc:
        return None, {"provider": "custom_yolo", "status": f"ultralytics unavailable: {exc}"}

    image = cv2.imread(image_path)
    if image is None:
        return None, {"provider": "custom_yolo", "status": "image read failed"}
    h, w = image.shape[:2]
    conf = float(os.getenv("SAHINAKSHA_YOLO_CONF", "0.35"))
    imgsz = int(os.getenv("SAHINAKSHA_YOLO_IMGSZ", "768"))
    device = os.getenv("SAHINAKSHA_YOLO_DEVICE", "0")

    try:
        model = YOLO(str(path))
        result = model.predict(source=image, conf=conf, imgsz=imgsz, device=device, verbose=False)[0]
    except Exception as exc:
        return None, {"provider": "custom_yolo", "status": f"inference failed: {exc}"}

    buildings, roads = [], []
    if result.masks is not None and result.boxes is not None:
        polygons = result.masks.xy
        classes = result.boxes.cls.cpu().numpy().astype(int).tolist()
        scores = result.boxes.conf.cpu().numpy().tolist()
        names = result.names
        for pts, cls_id, score in zip(polygons, classes, scores):
            coords = _poly(pts, w, h)
            if len(coords) < 4:
                continue
            class_name = str(names.get(cls_id, cls_id)).lower()
            feature_type = "building_footprint" if cls_id == 0 or class_name == "building" else "road_area"
            feature = {
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [coords]},
                "properties": {
                    "feature_type": feature_type,
                    "confidence": round(float(score), 4),
                    "model_provider": "sahinaksha_custom_yolo",
                    "review_required": float(score) < 0.65,
                },
            }
            (buildings if feature_type == "building_footprint" else roads).append(feature)

    fc = lambda xs: {"type": "FeatureCollection", "features": xs}
    return {"buildings": fc(buildings), "roads": fc(roads), "parcels": fc([])}, {
        "provider": "sahinaksha_custom_yolo",
        "status": "ready",
        "building_count": len(buildings),
        "road_count": len(roads),
        "input_size": [w, h],
        "confidence_threshold": conf,
        "message": "Custom model loaded. Parcel ownership boundaries still require GIS/survey evidence.",
    }
