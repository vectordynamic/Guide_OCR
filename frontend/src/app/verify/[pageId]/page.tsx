'use client';

/**
 * Verification Page - Split Screen View
 * Left: Image Viewer + Raw JSON
 * Right: Editable Question Forms
 */
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getOCRPage, processPageOCR, verifyPage, getChapterPages } from '@/lib/api';
import { OCRPage, Question, OCRResult } from '@/lib/types';
import ImageViewer from '@/components/ImageViewer';
import QuestionForm from '@/components/QuestionForm';
import JsonPreview from '@/components/JsonPreview';

export default function VerifyPage() {
    const params = useParams();
    const router = useRouter();
    const pageId = params.pageId as string;

    const [page, setPage] = useState<OCRPage | null>(null);
    const [allPages, setAllPages] = useState<OCRPage[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showRawJson, setShowRawJson] = useState(false);

    useEffect(() => {
        loadData();
    }, [pageId]);

    const loadData = async () => {
        try {
            const response = await getOCRPage(pageId);
            const pageData = response.data;
            setPage(pageData);

            // Load questions from verified or raw JSON
            const ocrData = pageData.verified_json || pageData.raw_ocr_json;
            setQuestions(ocrData?.questions || []);

            // Load all pages for navigation
            const pagesRes = await getChapterPages(pageData.chapter_id);
            setAllPages(pagesRes.data);
        } catch (error) {
            console.error('Failed to load page:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleProcessOCR = async () => {
        if (!page) return;
        setProcessing(true);
        try {
            const response = await processPageOCR(page._id);
            setQuestions(response.data.raw_ocr_json?.questions || []);
            loadData();
        } catch (error) {
            console.error('OCR processing failed:', error);
        } finally {
            setProcessing(false);
        }
    };

    const handleSave = async () => {
        if (!page) return;
        setSaving(true);
        try {
            const verifiedJson: OCRResult = { questions };

            // Check if any question continues on next page
            const continuesQuestion = questions.find(q => q.continues_on_next_page);
            const currentIndex = allPages.findIndex(p => p._id === page._id);
            const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

            await verifyPage(page._id, {
                verified_json: verifiedJson,
                continues_to_page: continuesQuestion && nextPage ? nextPage._id : undefined
            });

            loadData();
            alert('Saved successfully!');
        } catch (error) {
            console.error('Save failed:', error);
            alert('Save failed. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleQuestionChange = (index: number, question: Question) => {
        const updated = [...questions];
        updated[index] = question;
        setQuestions(updated);
    };

    const handleDeleteQuestion = (index: number) => {
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const addNewQuestion = () => {
        const newQuestion: Question = {
            type: 'short',
            question_text: '',
            has_image: false,
            metadata: {},
            hints: []
        };
        setQuestions([...questions, newQuestion]);
    };

    const navigateToPage = (targetPageId: string) => {
        router.push(`/verify/${targetPageId}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin text-4xl">⟳</div>
            </div>
        );
    }

    if (!page) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <p className="text-gray-400">Page not found</p>
            </div>
        );
    }

    const currentIndex = allPages.findIndex(p => p._id === page._id);
    const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
    const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

    return (
        <main className="h-screen bg-gray-900 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-4">
                    <Link href={`/chapters/${page.chapter_id}`} className="text-gray-400 hover:text-white text-sm">
                        ← Back
                    </Link>
                    <h1 className="text-lg font-semibold text-white">
                        Page {page.page_number} Verification
                    </h1>
                    <span className={`px-2 py-1 rounded text-xs ${page.ocr_status === 'verified' ? 'bg-green-900/30 text-green-400' :
                        page.ocr_status === 'completed' ? 'bg-blue-900/30 text-blue-400' :
                            'bg-gray-700 text-gray-400'
                        }`}>
                        {page.ocr_status}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {/* Navigation */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => prevPage && navigateToPage(prevPage._id)}
                            disabled={!prevPage}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white rounded text-sm"
                        >
                            ← Prev
                        </button>
                        <span className="text-gray-400 text-sm">
                            {currentIndex + 1} / {allPages.length}
                        </span>
                        <button
                            onClick={() => nextPage && navigateToPage(nextPage._id)}
                            disabled={!nextPage}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white rounded text-sm"
                        >
                            Next →
                        </button>
                    </div>

                    {/* Actions */}
                    {page.ocr_status !== 'verified' && (
                        <button
                            onClick={handleProcessOCR}
                            disabled={processing}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm disabled:opacity-50"
                        >
                            {processing ? 'Processing...' : page.ocr_status === 'pending' ? '🔍 Process OCR' : '🔄 Re-process OCR'}
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving || questions.length === 0}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : '💾 Save & Verify'}
                    </button>
                </div>
            </header>

            {/* Continuation Alert */}
            {page.continues_from_page && (
                <div className="bg-yellow-900/30 border-b border-yellow-700 px-4 py-2 text-yellow-400 text-sm flex items-center justify-between">
                    <span>⚠️ This page has a question continued from the previous page</span>
                    <button
                        onClick={() => prevPage && navigateToPage(prevPage._id)}
                        className="px-3 py-1 bg-yellow-700 hover:bg-yellow-600 rounded text-xs"
                    >
                        Go to Previous Page
                    </button>
                </div>
            )}

            {/* Split Screen Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Image + Raw JSON */}
                <div className="w-1/2 flex flex-col border-r border-gray-700">
                    {/* Image Viewer */}
                    <div className="flex-1 p-4">
                        <ImageViewer imageUrl={page.image_url} pageNumber={page.page_number} />
                    </div>

                    {/* Raw JSON Toggle */}
                    <div className="p-4 border-t border-gray-700">
                        <button
                            onClick={() => setShowRawJson(!showRawJson)}
                            className="w-full text-left text-sm text-gray-400 hover:text-white mb-2"
                        >
                            {showRawJson ? '▼' : '▶'} Raw OCR JSON
                        </button>
                        {showRawJson && (
                            <JsonPreview data={page.raw_ocr_json || null} />
                        )}
                    </div>
                </div>

                {/* Right Panel - Question Forms */}
                <div className="w-1/2 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-800/50">
                        <h2 className="text-lg font-medium text-white">
                            Questions ({questions.length})
                        </h2>
                        <button
                            onClick={addNewQuestion}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
                        >
                            + Add Question
                        </button>
                    </div>

                    {/* JSON Preview implementation for Right Panel */}
                    <div className="px-4 pt-4">
                        <JsonPreview data={page.raw_ocr_json || null} title="Raw OCR JSON (Reference)" />
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {questions.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <p className="mb-4">No questions extracted yet.</p>
                                {page.ocr_status === 'pending' && (
                                    <button
                                        onClick={handleProcessOCR}
                                        disabled={processing}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg"
                                    >
                                        {processing ? 'Processing...' : 'Process with AI OCR'}
                                    </button>
                                )}
                            </div>
                        ) : (
                            questions.map((question, index) => (
                                <QuestionForm
                                    key={index}
                                    question={question}
                                    index={index}
                                    onChange={handleQuestionChange}
                                    onDelete={handleDeleteQuestion}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
