# SahiNaksha fast model adaptation

This pipeline is designed for the SIH prototype when you have only **10-20 representative aerial images** and need a domain-adapted building-footprint model quickly.

## What it automates

1. Reads 10-20 aerial images from one folder.
2. Generates initial building masks with SAM when a SAM checkpoint is configured; otherwise uses an OpenCV roof proposal fallback.
3. Removes obvious vegetation/scene masks and converts masks to YOLO segmentation labels.
4. Creates train/validation splits automatically.
5. Creates 3 views per source image (original, horizontal flip, 90-degree rotation).
6. Fine-tunes a small pretrained segmentation model with augmentation and early stopping.
7. Writes `sahinaksha_building.pt` into the workspace.

Ultralytics supports training segmentation models from pretrained weights and polygon labels; this is transfer learning, not training a model from scratch.

## Windows quick start

From the repository root:

```powershell
cd training
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

Put 10-20 aerial images in:

```text
training/raw_images/
```

If you already have SAM ViT-B:

```powershell
$env:SAHINAKSHA_SAM_CHECKPOINT="$PWD\..\backend\models\sam_vit_b_01ec64.pth"
$env:SAHINAKSHA_SAM_MODEL_TYPE="vit_b"
```

Run:

```powershell
python auto_train.py --images .\raw_images --epochs 45
```

For a 2-hour deadline, start with 30-45 epochs. If you have an NVIDIA GPU, the script automatically uses CUDA. On CPU, reduce to `--epochs 20` and expect slower training.

## Important

With only 10-20 images, the model can adapt to the **visual domain represented by those images**, but it cannot honestly be expected to generalize to every city, drone, season, altitude, or sensor. Add diverse images later and retrain.

The generated labels are pseudo-labels. Before using the model for cadastral decisions, visually review them and replace incorrect masks with surveyed/GIS ground truth. The legal parcel boundary itself must not be fabricated from RGB imagery.
