"""
Books API Routes
"""
import os
import tempfile
from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from bson import ObjectId

from app.core.database import get_books_collection, get_chapters_collection, get_ocr_pages_collection, get_questions_collection
from app.models.schemas import BookCreate, BookResponse, PDFUploadResponse
from app.services.pdf_converter import convert_pdf_to_images
from app.services.r2_storage import get_r2_storage

router = APIRouter()


@router.get("/", response_model=list[BookResponse])
async def list_books():
    """Get all books."""
    books = await get_books_collection().find().to_list(100)
    for book in books:
        book["_id"] = str(book["_id"])
    return books


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(book_id: str):
    """Get a single book by ID."""
    book = await get_books_collection().find_one({"_id": ObjectId(book_id)})
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    book["_id"] = str(book["_id"])
    return book


@router.post("/", response_model=BookResponse)
async def create_book(book: BookCreate):
    """Create a new book (without PDF)."""
    doc = {
        **book.model_dump(),
        "total_pages": 0,
        "total_chapters": 0,
        "cover_image_url": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    result = await get_books_collection().insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


@router.post("/upload", response_model=PDFUploadResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    title: str = Form(...),
    subject: str = Form(...),
    class_name: str = Form(...),
    author: str = Form("NCTB"),
    chapters: str = Form(...)  # JSON array: [{"num": 1, "title": "...", "start": 1, "end": 35}]
):
    """
    Upload PDF and convert to images.
    
    1. Creates book entry
    2. Converts PDF to PNG images (300 DPI)
    3. Uploads images to R2
    4. Creates chapter and ocr_page entries
    """
    import json
    
    # Parse chapters JSON
    try:
        chapter_list = json.loads(chapters)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid chapters JSON")
    
    # Save uploaded PDF temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Convert PDF to images
        with tempfile.TemporaryDirectory() as tmp_dir:
            images = convert_pdf_to_images(tmp_path, tmp_dir)
            total_pages = len(images)
            
            # Auto-extend last chapter to cover all pages
            if chapter_list:
                last_chapter = chapter_list[-1]
                if last_chapter["end"] < total_pages:
                    last_chapter["end"] = total_pages
                    print(f"Auto-extended last chapter to cover all {total_pages} pages")
            
            # Create book entry
            book_doc = {
                "title": title,
                "subject": subject,
                "class_name": class_name,
                "author": author,
                "total_pages": total_pages,
                "total_chapters": len(chapter_list),
                "cover_image_url": None,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            book_result = await get_books_collection().insert_one(book_doc)
            book_id = str(book_result.inserted_id)
            
            # Upload images and create chapters/pages
            r2 = get_r2_storage()
            chapters_created = 0
            
            for ch in chapter_list:
                ch_num = ch["num"]
                ch_title = ch["title"]
                start_page = ch["start"]
                end_page = ch["end"]
                
                # Create chapter entry
                chapter_doc = {
                    "book_id": ObjectId(book_id),
                    "chapter_num": ch_num,
                    "title": ch_title,
                    "start_page": start_page,
                    "end_page": end_page,
                    "total_pages": end_page - start_page + 1,
                    "image_folder_url": f"{r2.public_domain}/books/{book_id}/chapters/ch_{ch_num:02d}/",
                    "ocr_status": "pending",
                    "created_at": datetime.utcnow()
                }
                ch_result = await get_chapters_collection().insert_one(chapter_doc)
                chapter_id = str(ch_result.inserted_id)
                chapters_created += 1
                
                # Upload pages for this chapter and collect docs for batch insert
                page_docs = []
                for page_num, local_path in images:
                    if start_page <= page_num <= end_page:
                        # Upload to R2
                        image_url = r2.upload_chapter_page(
                            local_path, book_id, ch_num, page_num
                        )
                        
                        # Collect page doc for batch insert
                        page_docs.append({
                            "book_id": ObjectId(book_id),
                            "chapter_id": ObjectId(chapter_id),
                            "page_number": page_num,
                            "image_url": image_url,
                            "ocr_status": "pending",
                            "raw_ocr_json": None,
                            "verified_json": None,
                            "continues_from_page": None,
                            "continues_to_page": None,
                            "created_at": datetime.utcnow(),
                            "updated_at": datetime.utcnow()
                        })
                
                # Batch insert all pages for this chapter
                if page_docs:
                    await get_ocr_pages_collection().insert_many(page_docs)
            
            # Set cover image (first page)
            if images:
                cover_url = r2.upload_file(
                    images[0][1],
                    f"books/{book_id}/cover.png"
                )
                await get_books_collection().update_one(
                    {"_id": ObjectId(book_id)},
                    {"$set": {"cover_image_url": cover_url}}
                )
            
            return PDFUploadResponse(
                book_id=book_id,
                total_pages=total_pages,
                chapters_created=chapters_created,
                message=f"Successfully uploaded {total_pages} pages across {chapters_created} chapters"
            )
    
    finally:
        # Cleanup temp PDF
        os.unlink(tmp_path)


@router.delete("/{book_id}")
async def delete_book(book_id: str):
    """Delete a book and all related data (MongoDB + R2 storage)."""
    # Check book exists
    book = await get_books_collection().find_one({"_id": ObjectId(book_id)})
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Delete from R2 storage
    try:
        r2 = get_r2_storage()
        # List and delete all files under books/{book_id}/
        prefix = f"books/{book_id}/"
        files = r2.list_files(prefix)
        for file_key in files:
            r2.delete_file(file_key)
        print(f"Deleted {len(files)} files from R2 for book {book_id}")
    except Exception as e:
        print(f"Warning: Failed to delete R2 files: {e}")
    
    # Delete related data from MongoDB
    await get_ocr_pages_collection().delete_many({"book_id": ObjectId(book_id)})
    await get_chapters_collection().delete_many({"book_id": ObjectId(book_id)})
    await get_questions_collection().delete_many({"book_id": ObjectId(book_id)})
    
    # Delete book
    await get_books_collection().delete_one({"_id": ObjectId(book_id)})
    
    return {"message": "Book and all related data deleted successfully"}

