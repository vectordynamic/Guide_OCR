/**
 * TypeScript types for the OCR system
 */

export type OCRStatus = 'pending' | 'processing' | 'completed' | 'verified';
export type QuestionType = 'mcq' | 'short' | 'creative';

export interface Book {
    _id: string;
    title: string;
    subject: string;
    class_name: string;
    author?: string;
    total_pages: number;
    total_chapters: number;
    cover_image_url?: string;
    created_at?: string;
}

export interface Chapter {
    _id: string;
    book_id: string;
    chapter_num: number;
    title: string;
    start_page: number;
    end_page: number;
    total_pages: number;
    image_folder_url?: string;
    ocr_status: OCRStatus;
}

export interface OCRPage {
    _id: string;
    book_id: string;
    chapter_id: string;
    page_number: number;
    image_url: string;
    ocr_status: OCRStatus;
    raw_ocr_json?: OCRResult;
    verified_json?: OCRResult;
    continues_from_page?: string;
    continues_to_page?: string;
    created_at?: string;
    updated_at?: string;
    version?: number;
}

export interface BoardAppearance {
    board: string;
    exam_year?: string;
    school_name?: string;
}

export interface QuestionMetadata {
    appearances?: BoardAppearance[];
    question_number?: string;
}

export interface SubQuestion {
    index: string;
    text: string;
    mark?: number;
    answer?: string;
    answer_image_url?: string;
}

export interface MCQOptions {
    ka: string;
    kha: string;
    ga: string;
    gha: string;
    [key: string]: string; // Allow dynamic key access
}

export interface Question {
    _id?: string;
    type: QuestionType;
    question_text: string;
    has_image: boolean;
    image_url?: string;
    image_description?: string;
    options?: MCQOptions;
    correct_answer?: string;
    answer?: string;
    answer_image_url?: string;
    sub_questions?: SubQuestion[];
    metadata?: QuestionMetadata;
    hints?: string[];
    continues_on_next_page?: boolean;
}

export interface OCRResult {
    questions: Question[];
    error?: string;
}

// Board names for autocomplete
export const BOARDS = [
    'Dhaka Board',
    'Rajshahi Board',
    'Cumilla Board',
    'Sylhet Board',
    'Chattogram Board',
    'Barishal Board',
    'Khulna Board',
    'Dinajpur Board',
    'Jessore Board',
    'Mymensingh Board',
];
