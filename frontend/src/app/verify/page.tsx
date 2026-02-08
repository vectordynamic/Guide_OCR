'use client';

/**
 * Verification Page - Content only (header is in layout)
 * URL format: /verify?page=pageId
 * Only the content area updates on navigation - header stays mounted in layout
 */
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useVerify } from '@/context/VerifyContext';
import ImageViewer from '@/components/ImageViewer';
import QuestionForm from '@/components/QuestionForm';
import JsonPreview from '@/components/JsonPreview';

function VerifyPageContent() {
    const searchParams = useSearchParams();
    const pageId = searchParams.get('page');
    const [showRawJson, setShowRawJson] = useState(false);

    const {
        page,
        questions,
        loading,
        pageLoading,
        processing,
        loadPage,
        handleProcessOCR,
        handleQuestionChange,
        handleDeleteQuestion,
        addNewQuestion
    } = useVerify();

    // Load page when pageId changes (from query param)
    useEffect(() => {
        if (pageId) {
            loadPage(pageId);
        }
    }, [pageId, loadPage]);

    // No page ID in URL
    if (!pageId) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-400">No page selected. Go back and select a page.</p>
            </div>
        );
    }

    // ONLY show full loading on very first load (no page data yet)
    if (!page && loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                    <span className="text-white">Loading...</span>
                </div>
            </div>
        );
    }

    // If page failed to load and we never had one
    if (!page) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-400">Page not found</p>
            </div>
        );
    }

    // Render content only - header is in layout
    return (
        <>
            {/* Page Loading Overlay */}
            {pageLoading && (
                <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-gray-800 rounded-lg px-6 py-4 flex items-center gap-3 shadow-2xl">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                        <span className="text-white text-sm">Loading page...</span>
                    </div>
                </div>
            )}

            {/* Split Screen Content */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Panel - Image + Raw JSON */}
                <div className="w-1/2 flex flex-col border-r border-gray-700">
                    <div className="flex-1 p-4">
                        <ImageViewer imageUrl={page.image_url} pageNumber={page.page_number} />
                    </div>
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
                                    key={`${page._id}-${index}`}
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
        </>
    );
}

// Wrap in Suspense for useSearchParams
export default function VerifyPage() {
    return (
        <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        }>
            <VerifyPageContent />
        </Suspense>
    );
}
