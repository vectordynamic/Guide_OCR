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
    
    # Track created resources for rollback
    created_book_id = None
    uploaded_chapter_images = [] # List of remote paths
    
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
            
            # Create book entry (Transaction Step 1)
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
            created_book_id = book_id
            
            # PARALLEL UPLOAD LOGIC
            r2 = get_r2_storage()
            import asyncio
            
            # Semaphore to limit concurrency (e.g., 20 parallel uploads)
            sem = asyncio.Semaphore(20)
            
            async def upload_page_wrapper(local_path, b_id, c_num, p_num):
                 async with sem:
                     # Run blocking upload in thread
                     url = await asyncio.to_thread(
                         r2.upload_chapter_page, local_path, b_id, c_num, p_num
                     )
                     return p_num, url

            # Prepare upload tasks
            upload_tasks = []
            
            # Map page number to chapter info for easy lookup
            page_to_chapter = {}
            for ch in chapter_list:
                for p in range(ch["start"], ch["end"] + 1):
                    page_to_chapter[p] = ch["num"]

            for page_num, local_path in images:
                if page_num in page_to_chapter:
                    ch_num = page_to_chapter[page_num]
                    upload_tasks.append(upload_page_wrapper(local_path, book_id, ch_num, page_num))
            
            # Execute uploads in parallel
            if upload_tasks:
                results = await asyncio.gather(*upload_tasks)
                # Store results in a dict for easy access
                uploaded_pages_map = {p_num: url for p_num, url in results}
            else:
                uploaded_pages_map = {}
            
            # Insert Chapters and Pages (Transaction Step 2)
            chapters_created = 0
            all_page_docs = []
            
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
                
                # Collect page docs
                for p_num in range(start_page, end_page + 1):
                    if p_num in uploaded_pages_map:
                        image_url = uploaded_pages_map[p_num]
                        all_page_docs.append({
                            "book_id": ObjectId(book_id),
                            "chapter_id": ObjectId(chapter_id),
                            "page_number": p_num,
                            "image_url": image_url,
                            "ocr_status": "pending",
                            "raw_ocr_json": None,
                            "verified_json": None,
                            "continues_from_page": None,
                            "continues_to_page": None,
                            "created_at": datetime.utcnow(),
                            "updated_at": datetime.utcnow()
                        })
            
            # Batch insert all pages
            if all_page_docs:
                await get_ocr_pages_collection().insert_many(all_page_docs)
            
            # Set cover image (first page)
            if images:
                # We already uploaded page 1, but we want a specific cover.png
                # Let's upload cover separately or copy? 
                # For now, let's just upload it (fast enough to do one more)
                cover_url = await asyncio.to_thread(
                     r2.upload_file, images[0][1], f"books/{book_id}/cover.png"
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

    except Exception as e:
        print(f"Upload failed. Rolling back... Error: {e}")
        # ROLLBACK
        if created_book_id:
            # 1. Delete R2 Files (Folder)
            try:
                r2 = get_r2_storage()
                prefix = f"books/{created_book_id}/"
                deleted_count = await asyncio.to_thread(r2.delete_folder, prefix)
                print(f"Rollback: Deleted {deleted_count} files from R2.")
            except Exception as r2_e:
                print(f"Rollback Error (R2): {r2_e}")
            
            # 2. Delete MongoDB Documents
            try:
                b_oid = ObjectId(created_book_id)
                await get_books_collection().delete_one({"_id": b_oid})
                await get_chapters_collection().delete_many({"book_id": b_oid})
                await get_ocr_pages_collection().delete_many({"book_id": b_oid})
                print(f"Rollback: Deleted MongoDB documents for book {created_book_id}")
            except Exception as db_e:
                print(f"Rollback Error (DB): {db_e}")
                
        raise HTTPException(status_code=500, detail=f"Upload failed and rolled back: {str(e)}")
    
    finally:
        # Cleanup temp PDF
        if os.path.exists(tmp_path):
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


@router.post("/{book_id}/chapters", response_model=BookResponse)
async def add_chapter(
    book_id: str,
    file: UploadFile = File(...),
    title: str = Form(...),
    chapter_num: int = Form(...)
):
    """
    Add a new chapter to an existing book by uploading a PDF.
    Appends the chapter to the end of the book.
    """
    # 1. Fetch Book
    book = await get_books_collection().find_one({"_id": ObjectId(book_id)})
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Calculate new start page
    current_total_pages = book.get("total_pages", 0)
    start_page = current_total_pages + 1
    
    # Save uploaded PDF temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
        
    # Track resources for rollback
    created_chapter_id = None
    uploaded_pages_info = [] # List of tuples (chapter_num, page_num)
    
    try:
        # 2. Convert PDF to images
        with tempfile.TemporaryDirectory() as tmp_dir:
            images = convert_pdf_to_images(tmp_path, tmp_dir)
            if not images:
                 raise HTTPException(status_code=400, detail="PDF contains no pages")
            
            new_chapter_pages = len(images)
            end_page = start_page + new_chapter_pages - 1
            
            # 3. Upload images and create chapter/pages
            r2 = get_r2_storage()
            
            # Create chapter entry (step 1)
            chapter_doc = {
                "book_id": ObjectId(book_id),
                "chapter_num": chapter_num,
                "title": title,
                "start_page": start_page,
                "end_page": end_page,
                "total_pages": new_chapter_pages,
                "image_folder_url": f"{r2.public_domain}/books/{book_id}/chapters/ch_{chapter_num:02d}/",
                "ocr_status": "pending",
                "created_at": datetime.utcnow()
            }
            ch_result = await get_chapters_collection().insert_one(chapter_doc)
            chapter_id = str(ch_result.inserted_id)
            created_chapter_id = chapter_id
            
            # PARALLEL UPLOAD LOGIC
            import asyncio
            sem = asyncio.Semaphore(20)
            
            async def upload_page_wrapper(local_path, b_id, c_num, p_num):
                 async with sem:
                     url = await asyncio.to_thread(
                         r2.upload_chapter_page, local_path, b_id, c_num, p_num
                     )
                     return p_num, url

            upload_tasks = []
            for i, (page_num, local_path) in enumerate(images):
                # Calculate absolute page number
                current_page_num_in_book = start_page + i
                upload_tasks.append(upload_page_wrapper(local_path, book_id, chapter_num, current_page_num_in_book))
                
            # Execute parallel uploads
            if upload_tasks:
                results = await asyncio.gather(*upload_tasks)
                uploaded_pages_map = {p_num: url for p_num, url in results}
            else:
                uploaded_pages_map = {}
            
            # Prepare page docs
            page_docs = []
            for i, (page_num, local_path) in enumerate(images):
                current_page_num_in_book = start_page + i
                if current_page_num_in_book in uploaded_pages_map:
                    image_url = uploaded_pages_map[current_page_num_in_book]
                    page_docs.append({
                        "book_id": ObjectId(book_id),
                        "chapter_id": ObjectId(chapter_id),
                        "page_number": current_page_num_in_book,
                        "image_url": image_url,
                        "ocr_status": "pending",
                        "raw_ocr_json": None,
                        "verified_json": None,
                        "continues_from_page": None,
                        "continues_to_page": None,
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    })
                
            if page_docs:
                await get_ocr_pages_collection().insert_many(page_docs)
                
            # 4. Update Book
            new_total_pages = current_total_pages + new_chapter_pages
            current_total_chapters = book.get("total_chapters", 0) + 1
            
            await get_books_collection().update_one(
                {"_id": ObjectId(book_id)},
                {"$set": {
                    "total_pages": new_total_pages,
                    "total_chapters": current_total_chapters,
                    "updated_at": datetime.utcnow()
                }}
            )
            
            # Return updated book
            updated_book = await get_books_collection().find_one({"_id": ObjectId(book_id)})
            updated_book["_id"] = str(updated_book["_id"])
            return updated_book

    except Exception as e:
        print(f"Add Chapter failed. Rolling back... Error: {e}")
        # ROLLBACK
        
        # 1. Delete R2 Files (specific chapter folder)
        try:
             # Folder structure: books/{book_id}/chapters/ch_{chapter_num}/
             r2 = get_r2_storage()
             prefix = f"books/{book_id}/chapters/ch_{chapter_num:02d}/"
             deleted = await asyncio.to_thread(r2.delete_folder, prefix)
             print(f"Rollback: Deleted {deleted} files from R2 for chapter {chapter_num}")
        except Exception as r2_e:
             print(f"Rollback Error (R2): {r2_e}")

        # 2. Delete MongoDB Documents
        try:
            if created_chapter_id:
                await get_chapters_collection().delete_one({"_id": ObjectId(created_chapter_id)})
                await get_ocr_pages_collection().delete_many({"chapter_id": ObjectId(created_chapter_id)})
                print(f"Rollback: Deleted MongoDB documents for chapter {created_chapter_id}")
        except Exception as db_e:
             print(f"Rollback Error (DB): {db_e}")

        raise HTTPException(status_code=500, detail=f"Chapter upload failed and rolled back: {str(e)}")

    finally:
        if os.path.exists(tmp_path):
             os.unlink(tmp_path)
