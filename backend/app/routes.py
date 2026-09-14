import json
from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from .services.analysis import analyze_image
from .services.export_service import to_json_bytes

router = APIRouter()
ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png"}
MAX_SIZE = 20 * 1024 * 1024
ANALYSES = {}


async def _save_upload(upload: UploadFile, directory: Path, allowed_suffixes=None):
    content = await upload.read()
    if not content:
        raise HTTPException(status_code=400, detail=f"{upload.filename or 'Uploaded file'} is empty.")
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Uploaded file exceeds the 20 MB prototype limit.")
    suffix = Path(upload.filename or "").suffix.lower()
    if allowed_suffixes and suffix not in allowed_suffixes:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")
    path = directory / f"{uuid4().hex}{suffix}"
    path.write_bytes(content)
    return path


@router.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    reference_parcels: UploadFile | None = File(None),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, JPEG and PNG images are supported.")

    uploads = Path(__file__).resolve().parents[1] / "uploads"
    uploads.mkdir(exist_ok=True)
    image_path = await _save_upload(file, uploads, {".jpg", ".jpeg", ".png"})

    reference_path = None
    if reference_parcels is not None:
        reference_path = await _save_upload(reference_parcels, uploads, {".json", ".geojson"})

    analysis_id = uuid4().hex
    try:
        result = analyze_image(str(image_path), str(reference_path) if reference_path else None)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    payload = {
        "analysis_id": analysis_id,
        "status": "completed",
        "original_image_url": f"/uploads/{image_path.name}",
        **result,
    }
    ANALYSES[analysis_id] = payload
    return payload


@router.get("/analysis/{analysis_id}/export")
def export_analysis(analysis_id: str):
    result = ANALYSES.get(analysis_id)
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found. Run the analysis again before exporting.")
    return Response(
        content=to_json_bytes(result),
        media_type="application/geo+json",
        headers={"Content-Disposition": f'attachment; filename="sahinaksha-{analysis_id}.geojson"'},
    )
