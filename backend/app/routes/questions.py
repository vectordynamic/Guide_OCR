"""
Questions API Routes
"""
from datetime import datetime
from fastapi import APIRouter, HTTPException
from bson import ObjectId

from app.core.database import get_questions_collection
from app.models.schemas import QuestionCreate, QuestionResponse

router = APIRouter()


@router.get("/", response_model=list[QuestionResponse])
async def list_questions(
    page_id: str = None,
    chapter_id: str = None,
    book_id: str = None,
    question_type: str = None,
    board: str = None,
    exam_year: str = None,
    school_name: str = None,
):
    """Get questions with optional filters."""
    query = {}
    
    if page_id:
        query["page_id"] = ObjectId(page_id)
    if chapter_id:
        query["chapter_id"] = ObjectId(chapter_id)
    if book_id:
        query["book_id"] = ObjectId(book_id)
    if question_type:
        query["type"] = question_type
    if board:
        query["metadata.appearances.board"] = board
    if exam_year:
        query["metadata.appearances.exam_year"] = exam_year
    if school_name:
        query["metadata.appearances.school_name"] = school_name
    
    questions = await get_questions_collection().find(query).to_list(500)
    
    for q in questions:
        q["_id"] = str(q["_id"])
        q["book_id"] = str(q["book_id"])
        q["chapter_id"] = str(q["chapter_id"])
        q["page_id"] = str(q["page_id"])
        if q.get("spans_pages"):
            q["spans_pages"] = [str(p) for p in q["spans_pages"]]
    
    return questions


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(question_id: str):
    """Get a single question by ID."""
    question = await get_questions_collection().find_one({"_id": ObjectId(question_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    question["_id"] = str(question["_id"])
    question["book_id"] = str(question["book_id"])
    question["chapter_id"] = str(question["chapter_id"])
    question["page_id"] = str(question["page_id"])
    if question.get("spans_pages"):
        question["spans_pages"] = [str(p) for p in question["spans_pages"]]
    
    return question


@router.post("/", response_model=QuestionResponse)
async def create_question(question: QuestionCreate):
    """Create a new question manually."""
    doc = {
        **question.model_dump(),
        "book_id": ObjectId(question.book_id),
        "chapter_id": ObjectId(question.chapter_id),
        "page_id": ObjectId(question.page_id),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    if question.spans_pages:
        doc["spans_pages"] = [ObjectId(p) for p in question.spans_pages]
    
    result = await get_questions_collection().insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    doc["book_id"] = str(doc["book_id"])
    doc["chapter_id"] = str(doc["chapter_id"])
    doc["page_id"] = str(doc["page_id"])
    if doc.get("spans_pages"):
        doc["spans_pages"] = [str(p) for p in doc["spans_pages"]]
    
    return doc


@router.put("/{question_id}", response_model=QuestionResponse)
async def update_question(question_id: str, question: QuestionCreate):
    """Update an existing question."""
    existing = await get_questions_collection().find_one({"_id": ObjectId(question_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Question not found")
    
    update_data = {
        **question.model_dump(exclude_unset=True),
        "updated_at": datetime.utcnow()
    }
    
    # Convert IDs
    if "book_id" in update_data:
        update_data["book_id"] = ObjectId(update_data["book_id"])
    if "chapter_id" in update_data:
        update_data["chapter_id"] = ObjectId(update_data["chapter_id"])
    if "page_id" in update_data:
        update_data["page_id"] = ObjectId(update_data["page_id"])
    if "spans_pages" in update_data and update_data["spans_pages"]:
        update_data["spans_pages"] = [ObjectId(p) for p in update_data["spans_pages"]]
    
    await get_questions_collection().update_one(
        {"_id": ObjectId(question_id)},
        {"$set": update_data}
    )
    
    # Return updated question
    updated = await get_questions_collection().find_one({"_id": ObjectId(question_id)})
    updated["_id"] = str(updated["_id"])
    updated["book_id"] = str(updated["book_id"])
    updated["chapter_id"] = str(updated["chapter_id"])
    updated["page_id"] = str(updated["page_id"])
    if updated.get("spans_pages"):
        updated["spans_pages"] = [str(p) for p in updated["spans_pages"]]
    
    return updated


@router.delete("/{question_id}")
async def delete_question(question_id: str):
    """Delete a question."""
    result = await get_questions_collection().delete_one({"_id": ObjectId(question_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    
    return {"message": "Question deleted successfully"}
