# SahiNaksha — Local Setup and Testing

This guide explains how to run the complete SahiNaksha MVP on **Windows** and **Linux Mint Cinnamon**.

---

# 1. Prerequisites

SahiNaksha requires:

- Git
- Python 3.10 or newer
- Node.js 18 or newer
- npm

The backend uses:

- FastAPI
- Uvicorn
- OpenCV
- NumPy
- Shapely

The frontend uses:

- React
- Vite
- Leaflet

---

# 2. Clone the Project

## Windows PowerShell

Open PowerShell or the VS Code terminal:

```powershell
git clone https://github.com/Syed-Sameer13/SahiNaksha.git
cd SahiNaksha
```

If the repository already exists:

```powershell
cd SahiNaksha
git pull origin main
```

## Linux Mint Cinnamon

Open Terminal:

```bash
git clone https://github.com/Syed-Sameer13/SahiNaksha.git
cd SahiNaksha
```

If the repository already exists:

```bash
cd SahiNaksha
git pull origin main
```

---

# 3. Windows Setup

## Step 1 — Install required software

Install:

### Git

```text
https://git-scm.com/download/win
```

### Python

```text
https://www.python.org/downloads/
```

During installation, select:

```text
Add Python to PATH
```

### Node.js

Install the LTS version:

```text
https://nodejs.org/
```

Verify installation:

```powershell
git --version
python --version
node --version
npm --version
```

---

## Step 2 — Backend setup

Open Terminal 1 inside the project:

```powershell
cd backend
python -m venv venv
```

### Activate the virtual environment

```powershell
.\venv\Scripts\Activate.ps1
```

If PowerShell blocks activation:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
```

You should see something similar to:

```text
(venv) PS ...\SahiNaksha\backend>
```

### Install dependencies

```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

If a required package is missing:

```powershell
pip install fastapi uvicorn python-multipart opencv-python numpy shapely
```

### Start the backend

```powershell
uvicorn app.main:app --reload
```

Expected:

```text
Uvicorn running on http://127.0.0.1:8000
```

Test:

```text
http://127.0.0.1:8000/health
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

Keep this terminal running.

---

## Step 3 — Frontend setup

Open **Terminal 2** from the project root:

```powershell
cd frontend
npm install
npm run dev
```

Vite will display a URL similar to:

```text
http://localhost:5173/
```

Open it in your browser.

---

# 4. Linux Mint Cinnamon Setup

## Step 1 — Update the system

Open Terminal:

```bash
sudo apt update
sudo apt upgrade -y
```

---

## Step 2 — Install Git and Python tools

```bash
sudo apt install -y git python3 python3-pip python3-venv
```

Verify:

```bash
git --version
python3 --version
pip3 --version
```

---

## Step 3 — Install Node.js

First try the distribution package:

```bash
sudo apt install -y nodejs npm
```

Verify:

```bash
node --version
npm --version
```

### Recommended: use NodeSource if Node.js is older than version 18

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify again:

```bash
node --version
npm --version
```

SahiNaksha should use Node.js 18 or newer.

---

## Step 4 — Backend setup

From the project root:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

Expected:

```text
(venv) user@computer:~/SahiNaksha/backend$
```

Upgrade pip and install dependencies:

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### If OpenCV installation causes problems

Install common system libraries:

```bash
sudo apt install -y libgl1 libglib2.0-0
```

Then retry:

```bash
pip install -r requirements.txt
```

### Start the backend

```bash
uvicorn app.main:app --reload
```

Expected:

```text
Uvicorn running on http://127.0.0.1:8000
```

Test in the browser:

```text
http://127.0.0.1:8000/health
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

Keep this terminal running.

---

## Step 5 — Frontend setup

Open a **second terminal**.

Go to the frontend:

```bash
cd ~/SahiNaksha/frontend
```

If your repository is located elsewhere, use that location instead.

Install packages:

```bash
npm install
```

Start Vite:

```bash
npm run dev
```

Open the URL printed by Vite, usually:

```text
http://localhost:5173/
```

---

# 5. Complete MVP Test

The testing procedure is identical on Windows and Linux.

## Step 1 — Open SahiNaksha

Open:

```text
http://localhost:5173/
```

## Step 2 — Upload an image

Supported formats:

- JPG
- JPEG
- PNG

For the best OpenCV results, use:

- Top-down aerial imagery
- Clearly visible buildings
- Clearly visible roads
- Good contrast
- Minimal labels
- No map controls or screenshots containing browser UI

---

## Step 3 — Run analysis

Click:

```text
Analyze Image
```

Expected processing flow:

```text
Aerial Image
    ↓
FastAPI Upload API
    ↓
OpenCV Preprocessing
    ↓
Edge Detection
    ↓
Building Candidates
    ↓
Road Candidates
    ↓
Preliminary Parcel Candidates
    ↓
Shapely Validation
    ↓
GeoJSON
    ↓
Interactive GIS Dashboard
```

---

# 6. Dashboard Test Checklist

## Layer controls

Test:

- [ ] Parcels can be toggled
- [ ] Buildings can be toggled
- [ ] Roads can be toggled

## Feature inspection

Click:

- [ ] A building
- [ ] A road
- [ ] A parcel candidate

Expected:

```text
Feature properties appear in the sidebar.
```

## Human review

Select a feature and test:

- [ ] Approve
- [ ] Needs Review
- [ ] Reject

## Validation

Check that the dashboard displays validation issues when geometry problems are found.

## GeoJSON export

Click:

```text
Export GeoJSON
```

The API endpoint is:

```text
GET /analysis/{analysis_id}/export
```

---

# 7. Troubleshooting

## Windows: virtual environment will not activate

Run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
```

---

## Windows: Python command not found

Try:

```powershell
py --version
py -m venv venv
```

Reinstall Python if necessary and ensure:

```text
Add Python to PATH
```

was selected during installation.

---

## Linux Mint: python command not found

Use:

```bash
python3
```

For example:

```bash
python3 -m venv venv
```

---

## Linux Mint: OpenCV fails to load

Install:

```bash
sudo apt install -y libgl1 libglib2.0-0
```

Then reinstall dependencies:

```bash
source venv/bin/activate
pip install -r requirements.txt
```

---

## Port 8000 is already in use

Stop the existing backend process or run:

```bash
uvicorn app.main:app --reload --port 8001
```

If you change the backend port, update the frontend API URL accordingly.

---

## Frontend cannot reach the backend

Confirm:

```text
http://127.0.0.1:8000/health
```

works first.

Then ensure the frontend API configuration points to:

```text
http://127.0.0.1:8000
```

---

## Analysis returns HTTP 500

Do not randomly reinstall packages or change code.

Check the backend terminal and copy the complete error. The terminal traceback identifies the actual failing component.

---

# 8. Stopping the Application

## Stop backend

Press:

```text
Ctrl + C
```

Then deactivate the environment:

### Windows

```powershell
deactivate
```

### Linux Mint

```bash
deactivate
```

## Stop frontend

Press:

```text
Ctrl + C
```

---

# 9. Quick Commands

## Windows

### Terminal 1

```powershell
cd SahiNaksha\backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

### Terminal 2

```powershell
cd SahiNaksha\frontend
npm run dev
```

---

## Linux Mint Cinnamon

### Terminal 1

```bash
cd ~/SahiNaksha/backend
source venv/bin/activate
uvicorn app.main:app --reload
```

### Terminal 2

```bash
cd ~/SahiNaksha/frontend
npm run dev
```

---

# 10. Demo Recommendation

Before presenting SahiNaksha:

- Test at least two aerial images.
- Keep one image that produces reliable results as your primary demo image.
- Start backend and frontend before evaluators arrive.
- Verify the health endpoint.
- Test one complete analysis.
- Keep the demo image locally available.

The current computer-vision system is prototype-grade. Results depend on imagery quality, which is why the human-review and validation stages are part of the MVP.
