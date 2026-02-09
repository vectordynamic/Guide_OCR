/**
 * API client for communicating with FastAPI backend
 */
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Books
export const getBooks = () => api.get('/books');
export const getBook = (id: string) => api.get(`/books/${id}`);
export const uploadPDF = (formData: FormData) =>
    api.post('/books/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
export const deleteBook = (id: string) => api.delete(`/books/${id}`);
export const addChapter = (bookId: string, formData: FormData) =>
    api.post(`/books/${bookId}/chapters`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

// Chapters
export const getChapters = (bookId: string) => api.get(`/chapters/book/${bookId}`);
export const getChapter = (id: string) => api.get(`/chapters/${id}`);
export const getChapterPages = (chapterId: string) => api.get(`/chapters/${chapterId}/pages`);

// OCR Pages
export const getOCRPage = (id: string) => api.get(`/ocr-pages/${id}`);
export const processPageOCR = (id: string) => api.post(`/ocr-pages/${id}/process`);
export const verifyPage = (id: string, data: { verified_json: object; continues_to_page?: string }) =>
    api.put(`/ocr-pages/${id}/verify`, data);
export const mergePages = (pageId: string, previousPageId: string) =>
    api.post(`/ocr-pages/${pageId}/merge/${previousPageId}`);

// Questions
export const getQuestions = (params?: { page_id?: string; chapter_id?: string; book_id?: string }) =>
    api.get('/questions', { params });
export const getQuestion = (id: string) => api.get(`/questions/${id}`);
export const updateQuestion = (id: string, data: object) => api.put(`/questions/${id}`, data);
export const deleteQuestion = (id: string) => api.delete(`/questions/${id}`);
export const uploadImage = (formData: FormData) =>
    api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

export default api;
