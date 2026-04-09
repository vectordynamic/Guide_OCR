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
        # When re-processing, we need to clear past sequence links
        await get_ocr_pages_collection().update_many(
            {"continues_from_page": ObjectId(page_id)},
            {"$unset": {"continues_from_page": ""}}
        )
        await get_ocr_pages_collection().update_many(
            {"continues_to_page": ObjectId(page_id)},
            {"$unset": {"continues_to_page": ""}}
        )

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
                },
                "$unset": {
                    "continues_from_page": "",
                    "continues_to_page": ""
                }
            }
        )
        
        # Check if we need to start sequence processing
        questions = result.get("questions", [])
        last_question_continues = False
        if questions and questions[-1].get("continues_on_next_page"):
            last_question_continues = True
            
        sequence_result = None
        if last_question_continues:
            from app.services.ocr_sequence_service import process_sequence
            sequence_result = await process_sequence(
                starting_page_id=page_id,
                starting_ocr_result=result
            )
        
        response_data = {
            "message": "OCR processing completed",
            "questions_found": len(result.get("questions", [])),
            "raw_ocr_json": result
        }
        
        if sequence_result:
            response_data["message"] = "OCR processing completed with auto-stitching"
            response_data["sequence"] = sequence_result
            
        return response_data
    
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


@router.post("/{page_id}/process-sequence")
async def process_page_sequence(page_id: str):
    """Manually trigger sequence processing starting from this page."""
    page = await get_ocr_pages_collection().find_one({"_id": ObjectId(page_id)})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
        
    if not page.get("raw_ocr_json"):
        raise HTTPException(status_code=400, detail="Page has no OCR data. Process OCR first.")
        
    questions = page["raw_ocr_json"].get("questions", [])
    if not questions or not questions[-1].get("continues_on_next_page"):
        return {"message": "No continuation found on this page.", "sequence": None}
        
    from app.services.ocr_sequence_service import process_sequence
    sequence_result = await process_sequence(
        starting_page_id=page_id,
        starting_ocr_result=page["raw_ocr_json"]
    )
    
    return {
        "message": "Sequence processing complete",
        "sequence": sequence_result
    }


@router.put("/{page_id}/verify")
async def verify_page(page_id: str, data: OCRPageVerify):
    """
    Save human-verified JSON for a page.
    
    1. Stores verified JSON
    2. Creates question entries in questions collection
    3. Updates page status to verified
    """
    
    # --- 0. OPTIMISTIC LOCKING CHECK ---
    # If the client sent an expected_version, we must ensure the DB matches.
    query = {"_id": ObjectId(page_id)}
    
    # If expected_version is provided, use it for the lock
    if data.expected_version is not None:
        # We need to handle the case where the document doesn't have a version field yet (v0)
        # In MongoDB, { "version": { "$exists": False } } counts as 0 logic-wise for our app
        if data.expected_version == 0:
            query["$or"] = [{"version": 0}, {"version": {"$exists": False}}]
        else:
            query["version"] = data.expected_version
            
        # Try to find the page with this specific version
        page = await get_ocr_pages_collection().find_one(query)
        
        if not page:
            # If page exists but version doesn't match -> Conflict
            # Check if page exists at all
            exists = await get_ocr_pages_collection().find_one({"_id": ObjectId(page_id)})
            if exists:
                raise HTTPException(
                    status_code=409, 
                    detail=f"Version Conflict. Client expected v{data.expected_version}, but DB is at v{exists.get('version', 0)}"
                )
            else:
                raise HTTPException(status_code=404, detail="Page not found")
    else:
        # No version check requested (legacy behavior), just fetch
        page = await get_ocr_pages_collection().find_one(query)
        if not page:
            raise HTTPException(status_code=404, detail="Page not found")

    
    
    # SMART CLEANUP: Identify and delete unused images from R2
    # 1. Gather all old image URLs from existing questions
    existing_questions = await get_questions_collection().find({"page_id": ObjectId(page_id)}).to_list(1000)
    old_images = set()
    for q in existing_questions:
        if q.get("image_url"):
            old_images.add(q["image_url"])
        if q.get("answer_image_url"):
            old_images.add(q["answer_image_url"])
        for sub in q.get("sub_questions", []) or []:
             if sub.get("answer_image_url"):
                 old_images.add(sub["answer_image_url"])
    
    # 2. Gather all new image URLs
    new_images = set()
    questions = data.verified_json.get("questions", [])
    for q in questions:
        if q.get("image_url"):
            new_images.add(q["image_url"])
        if q.get("answer_image_url"):
            new_images.add(q["answer_image_url"])
        for sub in q.get("sub_questions", []) or []:
             if sub.get("answer_image_url"):
                 new_images.add(sub["answer_image_url"])
                 
    # 3. Find images to delete (Present in Old but NOT in New)
    # Filter only for R2 URLs (not external ones if any, though likely all are R2)
    # We should only delete images that are in our 'uploads/' folder (screenshots/crops)
    # Book pages in 'books/' should NOT be deleted here as they belong to the page structure
    
    from app.services.r2_storage import get_r2_storage
    r2 = get_r2_storage()
    
    images_to_delete = []
    for img_url in old_images:
        if img_url not in new_images:
            # Check if it belongs to 'uploads/' (crops)
            # URL format: https://domain/uploads/YYYY-MM-DD/filename.png
            if "/uploads/" in img_url:
                # Extract Key from URL
                # stored remote_path is everything after domain/
                # e.g. https://algorxai.com/uploads/... -> uploads/...
                try:
                    # typical split by domain
                    # Assuming public_domain in settings doesn't have trailing slash, but URL might
                    key = img_url.replace(f"{r2.public_domain}/", "")
                    images_to_delete.append(key)
                except Exception:
                    pass

    # 4. Delete from R2
    if images_to_delete:
        print(f"Cleaning up {len(images_to_delete)} unused crop images for page {page_id}")
        import asyncio
        # Run deletions in background or parallel
        # Simple loop for now as it's usually small number
        for key in images_to_delete:
            asyncio.create_task(asyncio.to_thread(r2.delete_file, key))


    # Update continues_to_page if specified
    # Also increment version for optimistic locking
    new_version = page.get("version", 0) + 1
    
    update_data = {
        "verified_json": data.verified_json,
        "ocr_status": "verified",
        "updated_at": datetime.utcnow(),
        "version": new_version
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
    # Use explicit type check for debugging
    print(f"DEBUG: Deleting questions for page {page_id} (Type: {type(page_id)})")
    # Explicitly cast to string then ObjectId to be 100% sure
    delete_query = {"page_id": ObjectId(str(page_id))}
    delete_result = await get_questions_collection().delete_many(delete_query)
    questions_deleted = delete_result.deleted_count
    print(f"DEBUG: Deleted {questions_deleted} questions for page {page_id}")
    
    # Create question entries from verified JSON
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
        "questions_created": questions_created,
        "images_cleaned": len(images_to_delete)
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
