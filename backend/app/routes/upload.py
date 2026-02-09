"""
Upload API Routes
"""
import uuid
import os
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.r2_storage import get_r2_storage

router = APIRouter()

@router.post("/", response_model=dict)
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a file to R2 storage.
    Returns the public URL of the uploaded file.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    try:
        # Generate unique filename
        ext = os.path.splitext(file.filename)[1]
        if not ext:
            ext = ".png"
            
        filename = f"{uuid.uuid4()}{ext}"
        date_str = datetime.utcnow().strftime("%Y-%m-%d")
        remote_path = f"uploads/{date_str}/{filename}"
        
        # Save to temporary file first (R2Storage expects a path)
        temp_path = f"/tmp/{filename}"
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
            
        # Upload to R2
        r2 = get_r2_storage()
        url = r2.upload_file(temp_path, remote_path, content_type=file.content_type)
        
        # Clean up temp file
        os.remove(temp_path)
        
        return {"url": url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
