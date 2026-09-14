from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, File, HTTPException, UploadFile
from .services.analysis import analyze_image

router = APIRouter()
ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png"}
MAX_SIZE = 20 * 1024 * 1024

@router.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, JPEG and PNG images are supported.")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Image exceeds the 20 MB prototype limit.")
    analysis_id = uuid4().hex
    suffix = ALLOWED_TYPES[file.content_type]
    uploads = Path(__file__).resolve().parents[1] / "uploads"
    uploads.mkdir(exist_ok=True)
    filename = f"{analysis_id}{suffix}"
    path = uploads / filename
    path.write_bytes(content)
    result = analyze_image(str(path))
    return {"analysis_id":analysis_id,"status":"completed","original_image_url":f"/uploads/{filename}",**result}
