"""
Pydantic Models/Schemas for API
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


# Enums
class OCRStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    VERIFIED = "verified"


class QuestionType(str, Enum):
    MCQ = "mcq"
    SHORT = "short"
    CREATIVE = "creative"


# Book Schemas
class BookCreate(BaseModel):
    title: str
    subject: str
    class_name: str
    author: Optional[str] = "NCTB"


class BookResponse(BaseModel):
    id: str = Field(alias="_id")
    title: str
    subject: str
    class_name: str
    author: Optional[str] = None
    total_pages: int = 0
    total_chapters: int = 0
    cover_image_url: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


# Chapter Schemas
class ChapterCreate(BaseModel):
    book_id: str
    chapter_num: int
    title: str
    start_page: int
    end_page: int


class ChapterResponse(BaseModel):
    id: str = Field(alias="_id")
    book_id: str
    chapter_num: int
    title: str
    start_page: int
    end_page: int
    total_pages: int = 0
    image_folder_url: Optional[str] = None
    ocr_status: OCRStatus = OCRStatus.PENDING

    class Config:
        populate_by_name = True


# OCR Page Schemas
class OCRPageCreate(BaseModel):
    book_id: str
    chapter_id: str
    page_number: int
    image_url: str


class OCRPageResponse(BaseModel):
    id: str = Field(alias="_id")
    book_id: str
    chapter_id: str
    page_number: int
    image_url: str
    ocr_status: OCRStatus = OCRStatus.PENDING
    raw_ocr_json: Optional[dict] = None
    verified_json: Optional[dict] = None
    continues_from_page: Optional[str] = None
    continues_to_page: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    version: int = 0

    class Config:
        populate_by_name = True


class OCRPageVerify(BaseModel):
    verified_json: dict
    continues_to_page: Optional[str] = None
    expected_version: Optional[int] = None


# Question Schemas
class BoardAppearance(BaseModel):
    board: str
    exam_year: Optional[str] = None
    school_name: Optional[str] = None


class QuestionMetadata(BaseModel):
    appearances: List[BoardAppearance] = []
    question_number: Optional[str] = None


class SubQuestion(BaseModel):
    index: str  # ka, kha, ga, gha
    text: str
    mark: Optional[int] = None
    answer: Optional[str] = None
    answer_image_url: Optional[str] = None


class MCQOptions(BaseModel):
    ka: str
    kha: str
    ga: str
    gha: str


class QuestionCreate(BaseModel):
    book_id: str
    chapter_id: str
    page_id: str
    type: QuestionType
    question_text: str
    has_image: bool = False
    image_url: Optional[str] = None
    image_description: Optional[str] = None
    
    # MCQ
    options: Optional[MCQOptions] = None
    correct_answer: Optional[str] = None
    
    # Short Question
    answer: Optional[str] = None
    answer_image_url: Optional[str] = None
    
    # Creative Question
    sub_questions: Optional[List[SubQuestion]] = None
    
    # Metadata
    metadata: Optional[QuestionMetadata] = None
    hints: Optional[List[str]] = None
    spans_pages: Optional[List[str]] = None


class QuestionResponse(QuestionCreate):
    id: str = Field(alias="_id")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


# PDF Upload Response
class PDFUploadResponse(BaseModel):
    book_id: str
    total_pages: int
    chapters_created: int
    message: str
