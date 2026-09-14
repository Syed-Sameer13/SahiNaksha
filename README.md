# SahiNaksha 🗺️

## AI-Assisted Preliminary Urban Parcel Mapping

SahiNaksha is a hackathon MVP that demonstrates an AI-assisted workflow for converting aerial imagery into preliminary GIS features. It combines computer vision, topology validation, interactive map visualization, human review, and GeoJSON export.

> **Important:** SahiNaksha generates preliminary candidates. It is not presented as a replacement for official cadastral surveying or authoritative land records.

---

## The problem

Creating and updating spatial mapping data manually is time-consuming. Aerial imagery contains useful visual information about:

- Buildings
- Roads
- Visible boundaries
- Land-use patterns

SahiNaksha explores how computer vision can accelerate the first stage of GIS feature generation while keeping a human reviewer in the decision loop.

---

## What SahiNaksha does

```text
Upload Aerial Image
        ↓
OpenCV Image Processing
        ↓
Building Candidates + Road Candidates
        ↓
Preliminary Parcel Candidate Generation
        ↓
Topology Validation
        ↓
Interactive GIS Map
        ↓
Human Review
        ↓
GeoJSON Export
```

---

## Features

### 🖼️ Image upload
Accepts JPG, JPEG, and PNG imagery.

### 👁️ Computer vision
Uses OpenCV for:

- Image preprocessing
- Edge detection
- Contour detection
- Building candidate extraction
- Hough-line road candidate extraction

### 🗺️ GIS output
Features are returned as GeoJSON-compatible structures and displayed on an interactive Leaflet map.

### 🔍 Topology validation
Uses Shapely to check for:

- Invalid geometry
- Empty or zero-area geometry
- Small noise candidates
- Overlapping parcel candidates

### 👤 Human-in-the-loop review
A reviewer can inspect a detected feature and mark it:

- Approved
- Needs Review
- Rejected

### 📤 GeoJSON export
Completed analyses can be exported for further GIS use.

---

## Technology stack

### Frontend

- React
- Vite
- Leaflet
- React Leaflet

### Backend

- Python
- FastAPI
- Uvicorn

### Computer Vision and GIS

- OpenCV
- NumPy
- Shapely
- GeoJSON

---

## Project structure

```text
SahiNaksha/
├── README.md
├── SETUP.md
│
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── routes.py
│       └── services/
│           ├── analysis.py
│           ├── opencv_analysis.py
│           ├── validation.py
│           ├── geojson_service.py
│           └── export_service.py
│
└── frontend/
    └── src/
        ├── App.jsx
        ├── styles.css
        └── components/
            ├── UploadPanel.jsx
            └── Dashboard.jsx
```

---

## Run locally

See **[SETUP.md](SETUP.md)** for complete instructions.

Quick version:

```bash
# Backend
cd backend
python -m venv venv
# Activate the virtual environment
pip install -r requirements.txt
uvicorn app.main:app --reload
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

---

## MVP workflow

```text
INPUT
Aerial image

PROCESSING
OpenCV → GIS candidate generation → Shapely validation

OUTPUT
Buildings
Road features
Preliminary parcel candidates
Validation issues
Human review status
GeoJSON export
```

---

## Current MVP limitations

This is a prototype and intentionally has limitations:

- Parcel extraction is heuristic and not authoritative cadastral mapping.
- OpenCV results depend heavily on image quality.
- AI/CV output requires human verification.
- The system does not claim legal land-boundary accuracy.

These limitations are part of the motivation for the human-review workflow.

---

## Demo checklist

Before demonstrating:

- [ ] Backend starts successfully
- [ ] Frontend starts successfully
- [ ] Health endpoint works
- [ ] Aerial image uploads
- [ ] Dashboard opens
- [ ] Layers toggle correctly
- [ ] Features can be selected
- [ ] Human review buttons work
- [ ] GeoJSON export works

---

## Setup

👉 Read **SETUP.md** before running the project.

---

## License

Prototype created for educational and hackathon purposes.
