import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .routes import router

BASE_DIR = Path(__file__).resolve().parents[1]
UPLOADS_DIR = BASE_DIR / "uploads"
OUTPUTS_DIR = BASE_DIR / "outputs"
MODEL_PATH = Path(os.getenv("SAHINAKSHA_PIXEL_MODEL_PATH", str(BASE_DIR / "models" / "sahinaksha_pixel_model.joblib")))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
extra_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]

app = FastAPI(title="SahiNaksha API", version="0.4.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=default_origins + extra_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.include_router(router)

@app.get("/")
def root():
    return {"name": "SahiNaksha API", "status": "running", "model": "sahinaksha_pixel_model" if MODEL_PATH.exists() else "fallback"}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "SahiNaksha API",
        "trained_model": {
            "available": MODEL_PATH.exists(),
            "path": MODEL_PATH.name,
        },
    }
