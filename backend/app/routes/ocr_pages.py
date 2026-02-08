"""
OCR Pages API Routes
"""
from datetime import datetime
from fastapi import APIRouter, HTTPException
from bson import ObjectId

from app.core.database import get_ocr_pages_collection, get_questions_collection
from app.models.schemas import OCRPageResponse, OCRPageVerify
from app.services.ocr_processor import get_ocr_processor

router = APIRouter()


@router.get("/{page_id}", response_model=OCRPageResponse)
async def get_ocr_page(page_id: str):
    """Get a single OCR page with image URL and JSON data."""
    page = await get_ocr_pages_collection().find_one({"_id": ObjectId(page_id)})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    page["_id"] = str(page["_id"])
    page["book_id"] = str(page["book_id"])
    page["chapter_id"] = str(page["chapter_id"])
    if page.get("continues_from_page"):
        page["continues_from_page"] = str(page["continues_from_page"])
    if page.get("continues_to_page"):
        page["continues_to_page"] = str(page["continues_to_page"])
    
    return page


@router.post("/{page_id}/process")
async def process_page_ocr(page_id: str):
    """
    Trigger LLM OCR processing for a page.
    
    1. Gets page image URL
    2. Sends to LLM Vision API
    3. Stores raw JSON result
    """
    page = await get_ocr_pages_collection().find_one({"_id": ObjectId(page_id)})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Update status to processing
    await get_ocr_pages_collection().update_one(
        {"_id": ObjectId(page_id)},
        {"$set": {"ocr_status": "processing", "updated_at": datetime.utcnow()}}
    )
    
    try:
        # Process with LLM
        ocr = get_ocr_processor()
        result = await ocr.process_image(page["image_url"])
        
        # Store result
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
        
        return {
            "message": "OCR processing completed",
            "questions_found": len(result.get("questions", [])),
            "raw_ocr_json": result
        }
    
    except Exception as e:
        # Log detailed error
        import traceback
        print(f"OCR Error for page {page_id}: {str(e)}")
        print(traceback.format_exc())
        
        # Update status to failed
        await get_ocr_pages_collection().update_one(
            {"_id": ObjectId(page_id)},
            {
                "$set": {
                    "ocr_status": "pending",
                    "updated_at": datetime.utcnow()
                }
            }
        )
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


@router.put("/{page_id}/verify")
async def verify_page(page_id: str, data: OCRPageVerify):
    """
    Save human-verified JSON for a page.
    
    1. Stores verified JSON
    2. Creates question entries in questions collection
    3. Updates page status to verified
    """
    page = await get_ocr_pages_collection().find_one({"_id": ObjectId(page_id)})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Update continues_to_page if specified
    update_data = {
        "verified_json": data.verified_json,
        "ocr_status": "verified",
        "updated_at": datetime.utcnow()
    }
    
    if data.continues_to_page:
        update_data["continues_to_page"] = ObjectId(data.continues_to_page)
        # Also update the target page's continues_from_page
        await get_ocr_pages_collection().update_one(
            {"_id": ObjectId(data.continues_to_page)},
            {"$set": {"continues_from_page": ObjectId(page_id)}}
        )
    
    await get_ocr_pages_collection().update_one(
        {"_id": ObjectId(page_id)},
        {"$set": update_data}
    )
    
    # Delete existing questions for this page to prevent duplicates
    delete_result = await get_questions_collection().delete_many({"page_id": ObjectId(page_id)})
    questions_deleted = delete_result.deleted_count
    
    # Create question entries from verified JSON
    questions = data.verified_json.get("questions", [])
    questions_created = 0
    
    if questions:
        # Build all question documents
        question_docs = []
        for q in questions:
            question_doc = {
                "book_id": page["book_id"],
                "chapter_id": page["chapter_id"],
                "page_id": ObjectId(page_id),
                "type": q.get("type", "short"),
                "question_text": q.get("question_text", ""),
                "has_image": q.get("has_image", False),
                "image_url": q.get("image_url"),
                "image_description": q.get("image_description"),
                "options": q.get("options"),
                "correct_answer": q.get("correct_answer"),
                "answer": q.get("answer"),
                "sub_questions": q.get("sub_questions"),
                "metadata": q.get("metadata", {}),
                "hints": q.get("hints", []),
                "spans_pages": [page_id],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            question_docs.append(question_doc)
        
        # Insert all questions at once
        await get_questions_collection().insert_many(question_docs)
        questions_created = len(question_docs)
    
    return {
        "message": "Page verified successfully",
        "questions_deleted": questions_deleted,
        "questions_created": questions_created
    }


@router.post("/{page_id}/merge/{previous_page_id}")
async def merge_pages(page_id: str, previous_page_id: str):
    """
    Merge a question that spans two pages.
    
    Combines the last question from previous page with first question from current page.
    """
    current_page = await get_ocr_pages_collection().find_one({"_id": ObjectId(page_id)})
    previous_page = await get_ocr_pages_collection().find_one({"_id": ObjectId(previous_page_id)})
    
    if not current_page or not previous_page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Get verified JSON from both pages
    prev_json = previous_page.get("verified_json", {})
    curr_json = current_page.get("verified_json", {})
    
    prev_questions = prev_json.get("questions", [])
    curr_questions = curr_json.get("questions", [])
    
    if not prev_questions or not curr_questions:
        raise HTTPException(status_code=400, detail="Both pages must have verified questions")
    
    # Merge last question from previous with first question from current
    last_prev = prev_questions[-1]
    first_curr = curr_questions[0]
    
    # Combine question text
    merged_question = {
        **last_prev,
        "question_text": f"{last_prev.get('question_text', '')} {first_curr.get('question_text', '')}".strip(),
        "spans_pages": [previous_page_id, page_id]
    }
    
    # If current has sub_questions that previous doesn't, add them
    if first_curr.get("sub_questions") and not last_prev.get("sub_questions"):
        merged_question["sub_questions"] = first_curr["sub_questions"]
    elif first_curr.get("sub_questions") and last_prev.get("sub_questions"):
        # Merge sub_questions
        merged_question["sub_questions"] = last_prev["sub_questions"] + first_curr["sub_questions"]
    
    # Update previous page's last question
    prev_questions[-1] = merged_question
    prev_json["questions"] = prev_questions
    
    await get_ocr_pages_collection().update_one(
        {"_id": ObjectId(previous_page_id)},
        {"$set": {"verified_json": prev_json, "updated_at": datetime.utcnow()}}
    )
    
    # Remove first question from current page
    curr_questions = curr_questions[1:]
    curr_json["questions"] = curr_questions
    
    await get_ocr_pages_collection().update_one(
        {"_id": ObjectId(page_id)},
        {"$set": {"verified_json": curr_json, "updated_at": datetime.utcnow()}}
    )
    
    # Link pages
    await get_ocr_pages_collection().update_one(
        {"_id": ObjectId(previous_page_id)},
        {"$set": {"continues_to_page": ObjectId(page_id)}}
    )
    await get_ocr_pages_collection().update_one(
        {"_id": ObjectId(page_id)},
        {"$set": {"continues_from_page": ObjectId(previous_page_id)}}
    )
    
    return {
        "message": "Questions merged successfully",
        "merged_question": merged_question
    }
