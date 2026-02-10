"""
Chapters API Routes
"""
from datetime import datetime
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
    return {"message": f"Chapter OCR status updated to: {status}"}


@router.post("/{chapter_id}/process", response_model=dict)
async def process_chapter_ocr(chapter_id: str):
    """
    Trigger Batch OCR for all pending pages in a chapter.
    
    1. Fetches all pages for the chapter.
    2. Filters out 'completed' or 'verified' pages.
    3. Processes remaining pages in parallel (limit 5).
    """
    # 1. Get all pages
    pages = await get_ocr_pages_collection().find(
        {"chapter_id": ObjectId(chapter_id)}
    ).to_list(1000)
    
    if not pages:
        raise HTTPException(status_code=404, detail="No pages found for this chapter")
        
    # 2. Filter pending pages
    pending_pages = [
        p for p in pages 
        if p.get("ocr_status") not in ["completed", "verified"]
    ]
    
    if not pending_pages:
        return {
            "message": "All pages are already processed",
            "total_pages": len(pages),
            "processed_count": 0
        }
        
    # 3. Process in parallel with Semaphore
    import asyncio
    from app.services.ocr_processor import get_ocr_processor
    
    ocr = get_ocr_processor()
    sem = asyncio.Semaphore(5) # Limit to 5 concurrent LLM calls
    
    async def process_single_page(page):
        page_id = str(page["_id"])
        async with sem:
            try:
                # Update status to processing
                await get_ocr_pages_collection().update_one(
                    {"_id": ObjectId(page_id)},
                    {"$set": {"ocr_status": "processing", "updated_at": datetime.utcnow()}}
                )
                
                # Call LLM
                result = await ocr.process_image(page["image_url"])
                
                # Save result
                await get_ocr_pages_collection().update_one(
                    {"_id": ObjectId(page_id)},
                    {
                        "$set": {
                            "raw_ocr_json": result,
                            "ocr_status": "completed",
                            "updated_at": datetime.utcnow()
                        }
                    }
                )
                return True
            except Exception as e:
                print(f"Batch OCR Error for page {page_id}: {e}")
                # Revert to pending on failure
                await get_ocr_pages_collection().update_one(
                    {"_id": ObjectId(page_id)},
                    {"$set": {"ocr_status": "pending", "updated_at": datetime.utcnow()}}
                )
                return False

    # Execute batch
    tasks = [process_single_page(p) for p in pending_pages]
    results = await asyncio.gather(*tasks)
    
    success_count = sum(1 for r in results if r)
    
    return {
        "message": f"Batch processing started. Successfully processed {success_count}/{len(pending_pages)} pages.",
        "total_pages": len(pages),
        "processed_count": success_count,
        "failed_count": len(pending_pages) - success_count
    }
