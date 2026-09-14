# SahiNaksha — Local Setup and Testing

This guide explains how to run the complete SahiNaksha MVP on Windows.

## Prerequisites

Install:

- Python 3.10+
- Node.js 18+
- Git

Verify:

```bash
python --version
node --version
npm --version
git --version
```

## 1. Clone the project

```bash
git clone https://github.com/Syed-Sameer13/SahiNaksha.git
cd SahiNaksha
```

If you already cloned it:

```bash
git pull origin main
```

## 2. Start the backend

Open Terminal 1:

```bash
cd backend
python -m venv venv
```

### Windows PowerShell

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the API:

```bash
uvicorn app.main:app --reload
```

Check:

```text
http://127.0.0.1:8000/health
```

Expected:

```json
{"status":"ok","service":"SahiNaksha API"}
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

Keep Terminal 1 running.

## 3. Start the frontend

Open Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL, normally:

```text
http://localhost:5173
```

## 4. Test the complete workflow

1. Upload a JPG, JPEG, or PNG aerial image.
2. Click **Analyze Image**.
3. Wait for the dashboard.
4. Toggle Parcels, Buildings, and Roads.
5. Click detected features to inspect their properties.
6. Use Approve, Needs Review, or Reject.
7. Click **Export GeoJSON**.

## Expected pipeline

```text
Aerial Image
    ↓
FastAPI Upload API
    ↓
OpenCV Feature Extraction
    ↓
Buildings + Roads
    ↓
Preliminary Parcel Candidates
    ↓
Shapely Topology Validation
    ↓
GeoJSON
    ↓
Interactive GIS Dashboard
    ↓
Human Review + Export
```

## Troubleshooting

### PowerShell cannot activate venv

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### Missing Python packages

```bash
pip install fastapi uvicorn python-multipart opencv-python numpy shapely
```

### Frontend cannot reach backend

Make sure the backend is running at:

```text
http://127.0.0.1:8000
```

### Analysis fails

Check the backend terminal and copy the full error before changing code.

## Demo recommendation

Use clear top-down aerial imagery with visible buildings and roads. Avoid screenshots containing map controls, labels, or excessive text.
