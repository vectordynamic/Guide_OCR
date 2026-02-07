"""
Chapters API Routes
"""
from fastapi import APIRouter, HTTPException
from bson import ObjectId

from app.core.database import get_chapters_collection, get_ocr_pages_collection
from app.models.schemas import ChapterResponse

router = APIRouter()


@router.get("/book/{book_id}", response_model=list[ChapterResponse])
async def list_chapters(book_id: str):
    """Get all chapters for a book."""
    chapters = await get_chapters_collection().find(
        {"book_id": ObjectId(book_id)}
    ).sort("chapter_num", 1).to_list(100)
    
    for ch in chapters:
        ch["_id"] = str(ch["_id"])
        ch["book_id"] = str(ch["book_id"])
    
    return chapters


@router.get("/{chapter_id}", response_model=ChapterResponse)
async def get_chapter(chapter_id: str):
    """Get a single chapter by ID."""
    chapter = await get_chapters_collection().find_one({"_id": ObjectId(chapter_id)})
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    chapter["_id"] = str(chapter["_id"])
    chapter["book_id"] = str(chapter["book_id"])
    return chapter


@router.get("/{chapter_id}/pages")
async def list_chapter_pages(chapter_id: str):
    """Get all OCR pages for a chapter."""
    pages = await get_ocr_pages_collection().find(
        {"chapter_id": ObjectId(chapter_id)}
    ).sort("page_number", 1).to_list(500)
    
    for page in pages:
        page["_id"] = str(page["_id"])
        page["book_id"] = str(page["book_id"])
        page["chapter_id"] = str(page["chapter_id"])
        if page.get("continues_from_page"):
            page["continues_from_page"] = str(page["continues_from_page"])
        if page.get("continues_to_page"):
            page["continues_to_page"] = str(page["continues_to_page"])
    
    return pages


@router.patch("/{chapter_id}/ocr-status")
async def update_chapter_ocr_status(chapter_id: str, status: str):
    """Update OCR status for a chapter."""
    valid_statuses = ["pending", "processing", "completed", "verified"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    result = await get_chapters_collection().update_one(
        {"_id": ObjectId(chapter_id)},
        {"$set": {"ocr_status": status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    return {"message": f"Chapter OCR status updated to: {status}"}
