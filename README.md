# SahiNaksha 🗺️

## AI-Assisted Urban Parcel Mapping and Cadastral Feature Extraction — SIH 2026 PS-26012

SahiNaksha is an SIH prototype for extracting building/road evidence from drone or orthomosaic imagery, refining GIS parcel information, validating geometry, and presenting the result in a WebGIS workflow.

## Prototype pipeline

```text
Orthomosaic / Drone RGB
        ↓
Custom YOLO segmentation (if trained)
        ↓
Building + road polygons
        ↓
GIS parcel/reference refinement
        ↓
Topology validation
        ↓
Land-use / feature attributes
        ↓
Human review
        ↓
GeoJSON / WebGIS
```

## AI model strategy

The repository now includes a fast custom YOLO segmentation training path. Ultralytics segmentation models output object masks, polygons and confidence scores, making them suitable for the building/road feature-extraction stage. For a small SIH prototype, fine-tuning a pretrained model is preferred over training from scratch.

The runtime model order is:

1. `backend/models/sahinaksha_seg.pt` — custom YOLO model trained for this demo
2. `backend/models/sahinaksha_pixel_model.joblib` — CPU-friendly fallback
3. SAM — optional segmentation fallback

## 10-image demo training

Read [`training/10_IMAGE_DEMO_PROTOCOL.md`](training/10_IMAGE_DEMO_PROTOCOL.md).

The critical requirement is **labels**. Ten raw images cannot by themselves teach a model what a building or road is. Use 8 complete labelled scenes for training and hold out 2 complete scenes for validation/demo. With 20 scenes, use 16/4.

Train:

```bash
pip install -r training/requirements-yolo.txt
python training/quick_train_yolo.py --dataset training/dataset --epochs 60 --imgsz 768 --batch 4 --device 0
```

Then copy the resulting `best.pt` to:

```text
backend/models/sahinaksha_seg.pt
```

For CPU-only training use `--device cpu`, but GPU is strongly preferred for today's deadline.

## Cadastral accuracy rule

A detected building footprint is **not** a legal property boundary. SahiNaksha therefore does not fabricate ownership boundaries from RGB pixels. When an existing cadastral/GIS parcel layer is available, the system can refine and validate it using image evidence. Final cadastral boundaries require authoritative GIS/survey evidence and human verification.

## Current GIS prototype

The WebGIS uses image-local normalized coordinates (0..100) for the prototype. Production deployment should add GeoTIFF CRS handling, DSM/DTM, GNSS/CORS, authoritative cadastral layers and field-survey integration.

## Local setup

See [`SETUP.md`](SETUP.md) and [`AI_SETUP.md`](AI_SETUP.md).
