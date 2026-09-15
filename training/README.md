# SahiNaksha trained building + road model

This folder contains the fast SIH prototype training pipeline. It trains a CPU-friendly pixel segmentation model with three classes:

```text
0 = background
1 = building
2 = road
```

The trained model is used by the backend before the older SAM/OpenCV fallback.

## 1. Prepare the labelled dataset

Use original RGB aerial/drone images and matching grayscale PNG masks:

```text
training/dataset/images/
  image_001.jpg
  image_002.jpg

training/dataset/masks/
  image_001_mask.png
  image_002_mask.png
```

Mask values must be:

```text
0 background
1 building
2 road
```

Do not create legal parcel labels from RGB imagery. Parcel/ownership geometry must come from authoritative GIS/survey data.

## 2. Install

Windows:

```powershell
cd training
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

## 3. Train

```powershell
python train_pixel_model.py `
  --images .\dataset\images `
  --masks .\dataset\masks `
  --output ..\backend\models\sahinaksha_pixel_model.joblib `
  --trees 40 `
  --depth 12
```

The model is deliberately small and CPU-friendly. Training takes seconds/minutes on a normal laptop for a small SIH dataset. For a larger dataset, increase `--samples-per-class` and `--trees`.

## 4. Run the backend with the trained model

By default the backend looks for:

```text
backend/models/sahinaksha_pixel_model.joblib
```

Or set an explicit path:

```powershell
$env:SAHINAKSHA_PIXEL_MODEL_PATH="$PWD\..\backend\models\sahinaksha_pixel_model.joblib"
```

The backend inference order is:

```text
trained building+road model
        ↓ if unavailable
SAM
        ↓ if unavailable
OpenCV fallback
```

The UI will therefore continue to work if a model artifact is temporarily unavailable.

## 5. Current SIH prototype model

A first model was trained from three supplied aerial scenes with building and road masks. It achieved approximately **0.88-0.95 pixel accuracy on image-level holdout experiments**, depending on the held-out scene. These are small-domain prototype results, not a claim of general cadastral accuracy.

The three scenes are not enough for robust nationwide generalization. For the SIH demonstration, use imagery visually similar to the training domain. After the event, expand the dataset substantially and replace the lightweight model with a stronger aerial segmentation network.

## 6. Cadastral workflow

The AI detects physical evidence:

```text
RGB / orthomosaic
      ↓
Building + road segmentation
      ↓
GeoJSON feature polygons
      ↓
Existing cadastral GIS / survey data
      ↓
Boundary refinement + topology validation
      ↓
Human / survey verification
```

The system deliberately does **not** claim that an RGB image alone can determine legal ownership boundaries.
