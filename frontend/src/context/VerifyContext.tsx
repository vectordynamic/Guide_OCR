'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { getOCRPage, processPageOCR, verifyPage, getChapterPages } from '@/lib/api';
import { OCRPage, Question, OCRResult } from '@/lib/types';

interface VerifyContextType {
    // Page data
    page: OCRPage | null;
    allPages: OCRPage[];
    questions: Question[];
    originalQuestions: Question[];

    // Loading states
    loading: boolean;
    pageLoading: boolean;
    processing: boolean;
    saving: boolean;

    // Actions
    loadPage: (pageId: string) => Promise<void>;
    handleProcessOCR: () => Promise<void>;
    handleSave: () => Promise<void>;
    handleQuestionChange: (index: number, question: Question) => void;
    handleDeleteQuestion: (index: number) => void;
    addNewQuestion: () => void;
    hasChanges: () => boolean;

    // Navigation - internal state based (no URL change)
    goToNext: () => void;
    goToPrev: () => void;
    currentIndex: number;
    prevPage: OCRPage | null;
    nextPage: OCRPage | null;
}

const VerifyContext = createContext<VerifyContextType | null>(null);

export function useVerify() {
    const context = useContext(VerifyContext);
    if (!context) {
        throw new Error('useVerify must be used within a VerifyProvider');
    }
    return context;
}

interface VerifyProviderProps {
    children: ReactNode;
}

export function VerifyProvider({ children }: VerifyProviderProps) {
    const [page, setPage] = useState<OCRPage | null>(null);
    const [allPages, setAllPages] = useState<OCRPage[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [originalQuestions, setOriginalQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [pageLoading, setPageLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Use refs to avoid stale closures and infinite loops
    const currentPageIdRef = useRef<string | null>(null);
    const allPagesRef = useRef<OCRPage[]>([]);

    const loadPage = useCallback(async (pageId: string) => {
        // Skip if already loading this page
        if (currentPageIdRef.current === pageId) {
            return;
        }

        // Show page loading only if we already have a page (not initial load)
        if (currentPageIdRef.current) {
            setPageLoading(true);
        }

        currentPageIdRef.current = pageId;

        try {
            const response = await getOCRPage(pageId);
            const pageData = response.data;
            setPage(pageData);

            // Load questions from verified or raw JSON
            const ocrData = pageData.verified_json || pageData.raw_ocr_json;
            const loadedQuestions = ocrData?.questions || [];
            setQuestions(loadedQuestions);
            setOriginalQuestions(JSON.parse(JSON.stringify(loadedQuestions)));

            // Only load all pages if we don't have them or chapter changed
            if (allPagesRef.current.length === 0 || (allPagesRef.current[0] && allPagesRef.current[0].chapter_id !== pageData.chapter_id)) {
                const pagesRes = await getChapterPages(pageData.chapter_id);
                setAllPages(pagesRes.data);
                allPagesRef.current = pagesRes.data;
            }
        } catch (error) {
            console.error('Failed to load page:', error);
        } finally {
            setLoading(false);
            setPageLoading(false);
        }
    }, []); // No dependencies - uses refs

    const handleProcessOCR = useCallback(async () => {
        if (!page) return;
        setProcessing(true);
        try {
            const response = await processPageOCR(page._id);
            const newQuestions = response.data.raw_ocr_json?.questions || [];
            setQuestions(newQuestions);
            setOriginalQuestions(JSON.parse(JSON.stringify(newQuestions)));
            await loadPage(page._id);
        } catch (error) {
            console.error('OCR processing failed:', error);
        } finally {
            setProcessing(false);
        }
    }, [page, loadPage]);

    const hasChanges = useCallback(() => {
        return JSON.stringify(questions) !== JSON.stringify(originalQuestions);
    }, [questions, originalQuestions]);

    const handleSave = useCallback(async () => {
        if (!page || saving) return;

        setSaving(true);
        try {
            const verifiedJson: OCRResult = { questions };

            const continuesQuestion = questions.find(q => q.continues_on_next_page);
            const currentIdx = allPages.findIndex(p => p._id === page._id);
            const nextP = currentIdx < allPages.length - 1 ? allPages[currentIdx + 1] : null;

            await verifyPage(page._id, {
                verified_json: verifiedJson,
                continues_to_page: continuesQuestion && nextP ? nextP._id : undefined
            });

            setOriginalQuestions(JSON.parse(JSON.stringify(questions)));
            await loadPage(page._id);
            alert('Saved successfully!');
        } catch (error) {
            console.error('Save failed:', error);
            alert('Save failed. Please try again.');
        } finally {
            setSaving(false);
        }
    }, [page, saving, questions, allPages, loadPage]);

    const handleQuestionChange = useCallback((index: number, question: Question) => {
        setQuestions(prev => {
            const updated = [...prev];
            updated[index] = question;
            return updated;
        });
    }, []);

    const handleDeleteQuestion = useCallback((index: number) => {
        setQuestions(prev => prev.filter((_, i) => i !== index));
    }, []);

    const addNewQuestion = useCallback(() => {
        const newQuestion: Question = {
            type: 'short',
            question_text: '',
            has_image: false,
            metadata: {},
            hints: []
        };
        setQuestions(prev => [...prev, newQuestion]);
    }, []);

    // Compute navigation helpers
    const currentIndex = page ? allPages.findIndex(p => p._id === page._id) : -1;
    const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
    const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

    // Navigate to next/prev page - internal state only, NO URL change
    const goToNext = useCallback(() => {
        if (nextPage) {
            // Force load by clearing ref first
            currentPageIdRef.current = null;
            loadPage(nextPage._id);
        }
    }, [nextPage, loadPage]);

    const goToPrev = useCallback(() => {
        if (prevPage) {
            // Force load by clearing ref first
            currentPageIdRef.current = null;
            loadPage(prevPage._id);
        }
    }, [prevPage, loadPage]);

    return (
        <VerifyContext.Provider value={{
            page,
            allPages,
            questions,
            originalQuestions,
            loading,
            pageLoading,
            processing,
            saving,
            loadPage,
            handleProcessOCR,
            handleSave,
            handleQuestionChange,
            handleDeleteQuestion,
            addNewQuestion,
            hasChanges,
            goToNext,
            goToPrev,
            currentIndex,
            prevPage,
            nextPage
        }}>
            {children}
        </VerifyContext.Provider>
    );
}
