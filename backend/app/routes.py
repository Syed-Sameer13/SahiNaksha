from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from .services.analysis import analyze_image
from .services.export_service import to_json_bytes

router=APIRouter()
ALLOWED_TYPES={"image/jpeg":".jpg","image/png":".png"}
MAX_SIZE=20*1024*1024
ANALYSES={}

@router.post("/analyze")
async def analyze(file:UploadFile=File(...)):
    if file.content_type not in ALLOWED_TYPES: raise HTTPException(status_code=400,detail="Only JPG, JPEG and PNG images are supported.")
    content=await file.read()
    if not content: raise HTTPException(status_code=400,detail="Uploaded file is empty.")
    if len(content)>MAX_SIZE: raise HTTPException(status_code=400,detail="Image exceeds the 20 MB prototype limit.")
    analysis_id=uuid4().hex
    uploads=Path(__file__).resolve().parents[1]/"uploads";uploads.mkdir(exist_ok=True)
    filename=f"{analysis_id}{ALLOWED_TYPES[file.content_type]}";path=uploads/filename;path.write_bytes(content)
    result=analyze_image(str(path))
    payload={"analysis_id":analysis_id,"status":"completed","original_image_url":f"/uploads/{filename}",**result}
    ANALYSES[analysis_id]=payload
    return payload

@router.get("/analysis/{analysis_id}/export")
def export_analysis(analysis_id:str):
    result=ANALYSES.get(analysis_id)
    if not result: raise HTTPException(status_code=404,detail="Analysis not found. Run the analysis again before exporting.")
    return Response(content=to_json_bytes(result),media_type="application/geo+json",headers={"Content-Disposition":f'attachment; filename="sahinaksha-{analysis_id}.geojson"'})
