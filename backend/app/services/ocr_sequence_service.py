"""
OCR Sequence Service for handling recursive multi-page OCR stitching.
Implements the "Forward Push" strategy for partial questions.
"""
from typing import Dict, Any, List
from bson import ObjectId
from datetime import datetime

from app.core.database import get_ocr_pages_collection
from app.services.ocr_processor import get_ocr_processor


async def process_sequence(
    starting_page_id: str,
    starting_ocr_result: dict,
    max_depth: int = 5
) -> dict:
    """
    Recursively processes a sequence of pages that have continuation chains.
    Uses the "Forward Push" strategy: partial questions are removed from their
    starting page and pushed forward to the page where they complete.

    Returns:
    {
        "pages_processed": ["page_id_1", "page_id_2", ...],
        "total_questions_stitched": int,
        "sequence_depth": int
    }
    """
    ocr = get_ocr_processor()
    pages_collection = get_ocr_pages_collection()
    
    pages_processed = [starting_page_id]
    total_stitched = 0
    depth = 1
    
    current_page_id = starting_page_id
    current_result = starting_ocr_result

    print(f"Starting OCR Sequence processing from page: {starting_page_id}")

    while depth < max_depth:
        # Check if the current page has a question that continues to the next page
        questions = current_result.get("questions", [])
        
        # Robust check for nested questions (bug fix for model hallucinations)
        if questions and len(questions) == 1 and "questions" in questions[0] and isinstance(questions[0]["questions"], list):
            print(f"Sequence Fix: Detected nested questions on page {current_page_id}. Flattening...")
            questions = questions[0]["questions"]
            current_result["questions"] = questions
            
        if not questions:
            break
            
        last_question = questions[-1]
        
        # Does the last question continue to the next page?
        if not last_question.get("continues_on_next_page"):
            break
            
        # Get the current page from DB to find the chapter and page number
        current_page = await pages_collection.find_one({"_id": ObjectId(current_page_id)})
        if not current_page:
            print(f"Sequence Error: Current page {current_page_id} not found in DB.")
            break
            
        # Find the next page
        next_page = await pages_collection.find_one({
            "chapter_id": current_page["chapter_id"],
            "page_number": current_page["page_number"] + 1
        })
        
        if not next_page:
            print(f"Sequence Info: Reached end of chapter or next page doesn't exist.")
            break
            
        next_page_id = str(next_page["_id"])
        
        # Check if next_page was already processed to prevent infinite loops or overwriting verified content blindly
        # If it's verified, we shouldn't overwrite it automatically in a sequence.
        if next_page.get("ocr_status") == "verified":
             print(f"Sequence Info: Next page {next_page_id} is already verified. Stopping sequence.")
             break
        
        # Prepare continuation context (tail of the last question)
        # Take the last 300 characters of the question text or answer
        context_text = ""
        if last_question.get("type") == "creative" and last_question.get("sub_questions"):
            # If it's creative, it might be a sub-question answer that's cut off
            sub_q = last_question["sub_questions"][-1]
            if sub_q.get("answer"):
                context_text = sub_q["answer"][-300:]
            else:
                context_text = sub_q.get("text", "")[-300:]
        elif last_question.get("answer"):
            context_text = last_question["answer"][-300:]
        elif last_question.get("question_text"):
            context_text = last_question["question_text"][-300:]
            
        if not context_text:
            context_text = "Content was cut off."

        continuation_context = f"""
CONTINUATION CONTEXT:
The previous page ended with an incomplete question/answer.
Here is the tail (last portion) of that content:
---
{context_text}
---
If this page starts with the continuation of the above text, 
mark the FIRST question/answer with: "is_continuation": true
and include ONLY the continuation portion in that entry.
All other questions on this page should be extracted normally.
"""

        print(f"Sequence: Processing next page {next_page_id} (Depth {depth+1})")
        
        # Update next page status
        await pages_collection.update_one(
            {"_id": ObjectId(next_page_id)},
            {"$set": {"ocr_status": "processing", "updated_at": datetime.utcnow()}}
        )

        try:
            # Process next page with context
            next_result = await ocr.process_image(next_page["image_url"], continuation_context=continuation_context)
        except Exception as e:
            print(f"Sequence Error: Failed to process page {next_page_id}. {e}")
            # Revert status
            await pages_collection.update_one(
                {"_id": ObjectId(next_page_id)},
                {"$set": {"ocr_status": "pending", "updated_at": datetime.utcnow()}}
            )
            break

        # Check if the AI confirmed it's a continuation
        next_questions = next_result.get("questions", [])
        if not next_questions or not next_questions[0].get("is_continuation"):
            # AI says it's not a continuation. Trust AI and stop sequence.
            print(f"Sequence Info: AI did not confirm continuation on page {next_page_id}. Stopping sequence.")
            # We still save the result for the next page since we spent tokens on it!
            await pages_collection.update_one(
                {"_id": ObjectId(next_page_id)},
                {
                    "$set": {
                        "raw_ocr_json": next_result,
                        "ocr_status": "completed",
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            break
            
        # -- FORWARD PUSH STITCHING --
        first_next_question = next_questions[0]
        
        # Merge properties
        merged_question = {**last_question} # Copy the base metadata/start from Page N
        
        # 1. Merge Text
        if first_next_question.get("question_text"):
             merged_question["question_text"] = f"{merged_question.get('question_text', '')} {first_next_question['question_text']}".strip()
             
        # 2. Merge Answer
        if first_next_question.get("answer"):
            merged_question["answer"] = f"{merged_question.get('answer', '')} {first_next_question['answer']}".strip()
            
        # 3. Merge Sub-Questions (Creative)
        if first_next_question.get("sub_questions"):
            if not merged_question.get("sub_questions"):
                merged_question["sub_questions"] = first_next_question["sub_questions"]
            else:
                # Merge existing (this can be tricky if they overlap, assuming they append)
                # Typically, maybe the 'gha' answer is cut off, or new sub-questions appear
                # For simplicity, we append new sub-questions, and try to merge matching indices
                existing_subs = {sq["index"]: sq for sq in merged_question["sub_questions"]}
                for incoming_sq in first_next_question["sub_questions"]:
                    if incoming_sq["index"] in existing_subs:
                        # Append text and answer
                        existing = existing_subs[incoming_sq["index"]]
                        if incoming_sq.get("text"):
                            existing["text"] = f"{existing.get('text', '')} {incoming_sq['text']}".strip()
                        if incoming_sq.get("answer"):
                            existing["answer"] = f"{existing.get('answer', '')} {incoming_sq['answer']}".strip()
                    else:
                        merged_question["sub_questions"].append(incoming_sq)

        # Update spans pages
        spans = merged_question.get("spans_pages", [current_page_id])
        if next_page_id not in spans:
            spans.append(next_page_id)
        merged_question["spans_pages"] = spans
        
        # Determine if the merged question STILL continues (based on the next page's AI response for that fragment)
        merged_question["continues_on_next_page"] = first_next_question.get("continues_on_next_page", False)
        
        # Clean up continuation markers from the merged question before saving it
        merged_question.pop("is_continuation", None)
        merged_question.pop("continuation_of", None)
        merged_question.pop("continuation_sub_index", None)

        # Update Current Page (Remove the partial question from the end)
        current_result["questions"] = current_result["questions"][:-1]
        
        # Update Next Page (Replace the first entry with the merged question)
        next_result["questions"][0] = merged_question
        
        # Save to DB
        # Save current page
        await pages_collection.update_one(
            {"_id": ObjectId(current_page_id)},
            {
                "$set": {
                    "raw_ocr_json": current_result,
                    "continues_to_page": ObjectId(next_page_id),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        # Save next page
        await pages_collection.update_one(
            {"_id": ObjectId(next_page_id)},
            {
                "$set": {
                    "raw_ocr_json": next_result,
                    "ocr_status": "completed",
                    "continues_from_page": ObjectId(current_page_id),
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        pages_processed.append(next_page_id)
        total_stitched += 1
        depth += 1
        
        # Setup for next iteration
        current_page_id = next_page_id
        current_result = next_result

    print(f"Sequence finished. Pages processed: {pages_processed}")

    return {
        "pages_processed": pages_processed,
        "total_questions_stitched": total_stitched,
        "sequence_depth": depth
    }
