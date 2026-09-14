# SahiNaksha AI Segmentation Setup

This document enables the **AI extraction engine** used by the final SahiNaksha pipeline.

## What the AI engine does

When enabled, SahiNaksha runs:

Drone / Orthomosaic Image
        ↓
Segment Anything automatic masks
        ↓
Building / road / boundary evidence filtering
        ↓
Preliminary parcel candidate generation
        ↓
Topology repair
        ↓
Land-use classification
        ↓
Optional DSM height enrichment
        ↓
Optional ground-truth accuracy metrics
        ↓
Web-GIS review and GeoJSON export

## 1. Install the base backend first

Windows:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Linux:

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

## 2. Install the optional AI dependencies

```bash
pip install -r requirements-ai.txt
```

This installs PyTorch and the Segment Anything package.

## 3. Download a SAM checkpoint

Start with the ViT-B checkpoint because it is smaller than the larger SAM variants.

Create:

```text
backend/models/
```

Place the checkpoint there, for example:

```text
backend/models/sam_vit_b_01ec64.pth
```

Do not commit model checkpoints to Git.

## 4. Enable SAM

### Windows PowerShell

```powershell
$env:SAHINAKSHA_ENABLE_SAM="1"
$env:SAHINAKSHA_SAM_MODEL_TYPE="vit_b"
$env:SAHINAKSHA_SAM_CHECKPOINT="$PWD\models\sam_vit_b_01ec64.pth"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Run these commands from the `backend` directory.

### Linux Mint Cinnamon

```bash
export SAHINAKSHA_ENABLE_SAM=1
export SAHINAKSHA_SAM_MODEL_TYPE=vit_b
export SAHINAKSHA_SAM_CHECKPOINT="$PWD/models/sam_vit_b_01ec64.pth"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## 5. Confirm the AI engine is active

Run an analysis and check the SahiNaksha dashboard.

Expected status:

```text
AI segmentation engine active
AI: ready
Pipeline: ai_segmentation
```

If you instead see:

```text
SAM checkpoint not configured
```

the application is still running in conservative OpenCV fallback mode.

## Hardware reality

SAM can run on CPU, but CPU inference may be slow.

For the strongest live demo:

- use a CUDA-capable GPU if available
- pre-test the selected demo image
- keep image dimensions reasonable
- use an orthomosaic rather than an oblique drone photograph
- use an aligned existing parcel layer when available

## Important accuracy rule

SahiNaksha produces **preliminary cadastral output**. AI-generated boundaries must remain subject to GIS/survey review and field verification.
