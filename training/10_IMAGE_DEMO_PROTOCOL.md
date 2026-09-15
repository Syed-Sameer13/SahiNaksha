# SahiNaksha — 10-image accuracy-first demo protocol

## Important truth

Ten raw images are **not enough to train an accurate segmentation model**. Every training image needs trustworthy labels (building/road polygons or masks). If labels are unavailable, use the pretrained building model/SAM and call the result preliminary evidence rather than trained cadastral output.

## Recommended split for tomorrow's prototype

Use 10 complete scenes:

- 8 scenes: training
- 2 complete scenes: validation/demo holdout

Do not put crops from the same original scene into both train and validation. That would make the reported accuracy misleading.

For 20 scenes:

- 16 train
- 4 validation

## Labels

The fastest reliable annotation route is polygon masks. YOLO segmentation labels use one line per object:

```text
0 x1 y1 x2 y2 x3 y3 ...
```

where class `0` = building and class `1` = road, and coordinates are normalized to 0..1.

## Training command

From the repository root:

```bash
pip install -r training/requirements-yolo.txt
python training/quick_train_yolo.py --dataset training/dataset --epochs 60 --imgsz 768 --batch 4 --device 0
```

Use `--device cpu` if there is no NVIDIA GPU, but expect training to be substantially slower.

After training, copy:

```text
runs/.../weights/best.pt
```

to:

```text
backend/models/sahinaksha_seg.pt
```

The backend automatically prefers this custom model when it exists.

## Accuracy-first settings

For the demo, do not optimize for speed before accuracy. Use:

- 768px inference/training size
- confidence threshold 0.35 initially
- visually consistent orthomosaic imagery
- top-down imagery
- same approximate GSD/resolution across training and demo scenes
- validation on complete unseen scenes

Then test thresholds 0.25, 0.35, 0.45, 0.55 and keep the threshold that gives the cleanest validation polygons without hiding true buildings.

## What to show in the presentation

Report real validation measurements only:

- Building precision
- Building recall
- Building F1
- Building IoU/mAP if available
- Number of false positives/false negatives
- Number of topology errors

Never display a fabricated `95% accuracy` just because the demo looks good.

## Cadastral boundary rule

A building footprint is not a legal parcel boundary. SahiNaksha therefore treats AI outputs as preliminary feature evidence. Parcel ownership geometry should come from aligned cadastral GIS/reference layers and be reviewed by a surveyor/authorized user.

## Fallback order

The application uses:

```text
Custom SahiNaksha YOLO model
        ↓ if unavailable
CPU-friendly trained pixel model
        ↓ if unavailable
SAM segmentation
        ↓
WebGIS review + topology validation
```
