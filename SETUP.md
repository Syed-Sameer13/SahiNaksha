# SahiNaksha — Complete Setup & Run Guide

This is the fastest way to install and run the complete **SahiNaksha** MVP locally.

SahiNaksha has two applications:

```text
SahiNaksha/
├── backend/     # FastAPI + AI/CV processing
└── frontend/    # React + Vite + Leaflet GIS dashboard
```

---

# 1. Prerequisites

Install these once:

- Git
- Python **3.10+**
- Node.js **18+** (Node 20 LTS recommended)
- npm

Check:

```bash
git --version
python --version
node --version
npm --version
```

On Linux Mint, use `python3` if `python` is unavailable.

---

# 2. Get the Project

If you do not have the repository:

```bash
git clone https://github.com/Syed-Sameer13/SahiNaksha.git
cd SahiNaksha
```

If you already cloned it:

```bash
cd SahiNaksha
git pull origin main
```

---

# 3. FIRST-TIME INITIALIZATION

Do this **only once** on a new computer.

## Windows PowerShell

From the SahiNaksha root folder:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
cd ..\frontend
npm install
cd ..
```

If PowerShell blocks virtual-environment activation:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\backend\venv\Scripts\Activate.ps1
```

### Windows Python alternative

If `python` is not recognized:

```powershell
py -m venv backend\venv
.\backend\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
cd frontend
npm install
cd ..
```

---

## Linux Mint / Ubuntu

From the SahiNaksha root folder:

```bash
sudo apt update
sudo apt install -y git python3 python3-pip python3-venv nodejs npm
```

Check Node.js:

```bash
node --version
```

Node 18+ is required. If the distribution version is older, install a current Node.js LTS release before continuing.

Then initialize SahiNaksha:

```bash
python3 -m venv backend/venv
source backend/venv/bin/activate
python -m pip install --upgrade pip
pip install -r backend/requirements.txt
cd frontend
npm install
cd ..
```

If OpenCV has system-library issues:

```bash
sudo apt install -y libgl1 libglib2.0-0
```

---

# 4. RUN THE COMPLETE WEBSITE

The backend and frontend must run at the same time.

## Windows — Terminal 1: Backend

Open PowerShell in the project root:

```powershell
cd SahiNaksha\backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

Health check:

```text
http://127.0.0.1:8000/health
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

Keep Terminal 1 running.

---

## Windows — Terminal 2: Frontend

Open a second PowerShell window:

```powershell
cd SahiNaksha\frontend
npm run dev
```

Open the URL shown by Vite, normally:

```text
http://localhost:5173/
```

---

## Linux Mint — Terminal 1: Backend

```bash
cd ~/SahiNaksha/backend
source venv/bin/activate
uvicorn app.main:app --reload
```

---

## Linux Mint — Terminal 2: Frontend

```bash
cd ~/SahiNaksha/frontend
npm run dev
```

Open:

```text
http://localhost:5173/
```

---

# 5. DAILY STARTUP — AFTER INITIALIZATION

You **do not need to reinstall anything** every time.

### Windows

Terminal 1:

```powershell
cd SahiNaksha\backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

Terminal 2:

```powershell
cd SahiNaksha\frontend
npm run dev
```

### Linux Mint

Terminal 1:

```bash
cd ~/SahiNaksha/backend
source venv/bin/activate
uvicorn app.main:app --reload
```

Terminal 2:

```bash
cd ~/SahiNaksha/frontend
npm run dev
```

Then open:

```text
http://localhost:5173/
```

---

# 6. AI / CUSTOM YOLO SETUP

The normal backend works without the optional custom YOLO model.

For the SahiNaksha custom segmentation model, install the AI dependencies inside the backend virtual environment:

```bash
cd backend
```

### Windows

```powershell
.\venv\Scripts\Activate.ps1
pip install -r requirements-ai.txt
```

### Linux Mint

```bash
source venv/bin/activate
pip install -r requirements-ai.txt
```

The custom model is expected at:

```text
backend/models/sahinaksha_seg.pt
```

The runtime model priority is:

```text
Custom YOLO segmentation
        ↓
Trained pixel model
        ↓
SAM (if configured)
        ↓
Computer-vision fallback
```

If `sahinaksha_seg.pt` is not present, SahiNaksha can still start; the available fallback pipeline is used.

---

# 7. TRAINING A CUSTOM MODEL

Training requires **labelled images**, not just raw images.

Recommended dataset:

```text
training/dataset/
├── images/
│   ├── train/
│   └── val/
├── labels/
│   ├── train/
│   └── val/
└── sahinaksha.yaml
```

For 10 complete scenes, use approximately:

```text
8 scenes → training
2 scenes → validation
```

For 20 scenes:

```text
16 scenes → training
4 scenes → validation
```

Do not put crops from the same scene into both train and validation sets.

Install training dependencies:

```bash
pip install -r training/requirements-yolo.txt
```

Train:

```bash
python training/quick_train_yolo.py --dataset training/dataset --epochs 60 --imgsz 768 --batch 4 --device 0
```

For CPU-only training:

```bash
python training/quick_train_yolo.py --dataset training/dataset --epochs 60 --imgsz 768 --batch 2 --device cpu
```

After training, copy the best checkpoint to:

```text
backend/models/sahinaksha_seg.pt
```

See:

```text
training/10_IMAGE_DEMO_PROTOCOL.md
```

for the complete 10–20 image prototype protocol.

---

# 8. RUNNING THE DEMO

1. Start the backend.
2. Start the frontend.
3. Open:

```text
http://localhost:5173/
```

4. Upload an aerial/orthomosaic image.
5. Click **Analyze Image**.
6. Review the generated GIS layers.
7. Inspect buildings, roads and parcel/reference features.
8. Use human-review controls where required.
9. Export GeoJSON when available.

Expected high-level flow:

```text
Aerial / Orthomosaic Image
          ↓
       Upload
          ↓
      FastAPI API
          ↓
    AI / CV Analysis
          ↓
 Building + Road Features
          ↓
 Geometry / Topology Validation
          ↓
       GeoJSON
          ↓
     WebGIS Dashboard
          ↓
 Human Review / Correction
```

---

# 9. BEST DEMO DATA

For reliable prototype results, use images with:

- Top-down aerial/orthomosaic view
- High resolution
- Clearly visible building roofs
- Clearly visible roads
- Consistent image quality/resolution
- Limited tree/building occlusion
- Minimal blur and shadows

For supervised training, each image must have corresponding building/road labels or polygons.

**Building footprints are not automatically legal cadastral/property boundaries.** Official ownership boundaries require authoritative cadastral/GIS/survey data.

---

# 10. TROUBLESHOOTING

## `python` is not recognized — Windows

Try:

```powershell
py --version
```

Then:

```powershell
py -m venv backend\venv
```

---

## PowerShell refuses to activate venv

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\backend\venv\Scripts\Activate.ps1
```

---

## `npm` or `node` is not recognized

Install Node.js 18+ and restart the terminal.

Verify:

```bash
node --version
npm --version
```

---

## `vite` is not recognized

From `frontend`:

```bash
npm install
npm run dev
```

Do **not** install Vite globally just to fix this error.

---

## Backend does not start

Activate the virtual environment and reinstall backend dependencies:

### Windows

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Linux

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

## Frontend says it cannot connect to backend

First check:

```text
http://127.0.0.1:8000/health
```

If this does not work, fix the backend first.

The normal local API address is:

```text
http://127.0.0.1:8000
```

---

## Port 8000 is already in use

Run the backend on another port:

```bash
uvicorn app.main:app --reload --port 8001
```

If you do this, update the frontend API configuration to use port `8001`.

---

## Analysis returns HTTP 500

Look at the backend terminal and copy the complete traceback. Do not randomly reinstall packages or change application code before checking the actual error.

---

# 11. STOP THE WEBSITE

In both frontend and backend terminals:

```text
Ctrl + C
```

For the backend virtual environment:

```bash
deactivate
```

---

# 12. QUICK REFERENCE

### First time

```text
Clone repository
      ↓
Create Python venv
      ↓
Install backend requirements
      ↓
Install frontend npm packages
      ↓
(Optional) Install AI requirements
      ↓
Ready
```

### Every day

```text
Terminal 1:
backend → activate venv → uvicorn

Terminal 2:
frontend → npm run dev

Browser:
http://localhost:5173/
```

### Before SIH presentation

- [ ] Backend starts successfully
- [ ] `/health` works
- [ ] Frontend loads
- [ ] Test image uploads successfully
- [ ] Analysis completes
- [ ] Building/road layers appear
- [ ] Human-review workflow works
- [ ] GeoJSON export works
- [ ] Primary demo image is tested beforehand
- [ ] AI model/checkpoint is present if using custom YOLO
- [ ] Do not claim an accuracy percentage that has not been measured on held-out labelled data
