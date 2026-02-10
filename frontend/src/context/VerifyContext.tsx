'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { getOCRPage, processPageOCR, verifyPage, getChapterPages } from '@/lib/api';
import { OCRPage, Question, OCRResult, SubQuestion } from '@/lib/types';
import { uploadImage } from '@/lib/api';

export interface CropTarget {
    index: number;
    subIndex?: number; // For sub-questions
    type: 'question' | 'sub_question';
    field: 'image_url' | 'answer_image_url'; // Field to update
}

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

    // Cropping
    cropTarget: CropTarget | null;
    isCropMode: boolean;
    startCrop: (target: CropTarget) => void;
    cancelCrop: () => void;
    completeCrop: (imageBlob: Blob) => Promise<void>;
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

    // Crop State
    const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
    const [pendingImages, setPendingImages] = useState<Record<string, Blob>>({});

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

        // Reset pending images on page load
        setPendingImages(prev => {
            // Optional: revoke old URLs if we want to be strict, but they might be used in the UI still if we just switch quickly
            // For now, simpler to just clear the map so we don't upload old stuff
            return {};
        });

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
            // PROCESS PENDING UPLOADS
            const currentQuestions = [...questions];
            let hasUploads = false;

            // Helper to recursively find and replace blob URLs
            const uploadPendingBlob = async (url: string | undefined): Promise<string | undefined> => {
                if (!url || !url.startsWith('blob:')) return url;

                const blob = pendingImages[url];
                if (!blob) return url; // Should not happen

                hasUploads = true;
                const formData = new FormData();
                formData.append('file', blob, 'crop.png');

                try {
                    const res = await uploadImage(formData);
                    // Revoke local URL to free memory
                    URL.revokeObjectURL(url);
                    return res.data.url;
                } catch (e) {
                    console.error('Failed to upload blob:', url, e);
                    throw new Error('Failed to upload some images. Please try saving again.');
                }
            };

            // Iterate and replace all image URLs in questions
            for (let i = 0; i < currentQuestions.length; i++) {
                const q = { ...currentQuestions[i] };

                // Main Question Images
                if (q.image_url?.startsWith('blob:')) {
                    q.image_url = await uploadPendingBlob(q.image_url);
                }
                if (q.answer_image_url?.startsWith('blob:')) {
                    q.answer_image_url = await uploadPendingBlob(q.answer_image_url);
                }

                // Sub-question Images
                if (q.sub_questions) {
                    for (let j = 0; j < q.sub_questions.length; j++) {
                        const sq = { ...q.sub_questions[j] };
                        if (sq.answer_image_url?.startsWith('blob:')) {
                            sq.answer_image_url = await uploadPendingBlob(sq.answer_image_url);
                        }
                        q.sub_questions[j] = sq;
                    }
                }
                currentQuestions[i] = q;
            }

            // If we had uploads, update state with new URLs so UI reflects permanent links
            if (hasUploads) {
                setQuestions(currentQuestions);
                // Clear pending images after successful upload
                setPendingImages({});
            }

            const verifiedJson: OCRResult = { questions: currentQuestions };

            const continuesQuestion = currentQuestions.find(q => q.continues_on_next_page);
            const currentIdx = allPages.findIndex(p => p._id === page._id);
            const nextP = currentIdx < allPages.length - 1 ? allPages[currentIdx + 1] : null;

            // OPTIMISTIC LOCKING: Send the version we currently have
            const expectedVersion = page.version || 0;

            await verifyPage(page._id, {
                verified_json: verifiedJson,
                continues_to_page: continuesQuestion && nextP ? nextP._id : undefined,
                expected_version: expectedVersion
            });

            // If we reach here, save was successful.
            // Update local state is handled by reloading the page below.
            setOriginalQuestions(JSON.parse(JSON.stringify(currentQuestions)));
            await loadPage(page._id);
            alert('Saved successfully!');
        } catch (error: any) {
            console.error('Save failed:', error);

            if (error.response && error.response.status === 409) {
                alert('Conflict Detected: The page was modified by another process (or double-click). Reducing data loss by reloading the latest version...');
                // Force reload to get latest version
                await loadPage(page._id);
            } else {
                alert('Save failed. Please try again.');
            }
        } finally {
            setSaving(false);
        }
    }, [page, saving, questions, allPages, loadPage, pendingImages]);

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
            nextPage,
            cropTarget,
            isCropMode: !!cropTarget,
            startCrop: setCropTarget,
            cancelCrop: () => setCropTarget(null),
            completeCrop: async (blob: Blob) => {
                if (!cropTarget) return;

                try {
                    // Create local object URL for immediate preview
                    const localUrl = URL.createObjectURL(blob);

                    // Store blob for later upload
                    setPendingImages(prev => ({
                        ...prev,
                        [localUrl]: blob
                    }));

                    setQuestions(prev => {
                        const updated = [...prev];
                        const q = { ...updated[cropTarget.index] };

                        if (cropTarget.type === 'question') {
                            // Update main question
                            if (cropTarget.field === 'image_url') {
                                q.image_url = localUrl;
                                q.has_image = true;
                            } else if (cropTarget.field === 'answer_image_url') {
                                q.answer_image_url = localUrl;
                            }
                        } else if (cropTarget.type === 'sub_question' && typeof cropTarget.subIndex === 'number') {
                            // Update sub-question
                            const subQs = [...(q.sub_questions || [])];
                            if (subQs[cropTarget.subIndex]) {
                                subQs[cropTarget.subIndex] = {
                                    ...subQs[cropTarget.subIndex],
                                    [cropTarget.field]: localUrl
                                };
                                q.sub_questions = subQs;
                            }
                        }

                        updated[cropTarget.index] = q;
                        return updated;
                    });

                    setCropTarget(null);
                } catch (error) {
                    console.error('Failed to process crop:', error);
                    alert('Failed to process image. Please try again.');
                }
            }
        }}>
            {children}
        </VerifyContext.Provider>
    );
}
