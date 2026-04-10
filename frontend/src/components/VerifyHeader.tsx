'use client';

/**
 * VerifyHeader - Persistent header component for verification pages
 * Lives in layout so it never remounts during navigation
 * Uses internal state navigation (no URL changes)
 */
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useVerify } from '@/context/VerifyContext';

export default function VerifyHeader() {
    const {
        page,
        allPages,
        pageLoading,
        processing,
        processingStatus,
        saving,
        bgRunning,
        startBgChain,
        selectedModel,
        setSelectedModel,
        handleProcessOCR,
        handleSave,
        questions,
        hasChanges,
        goToNext,
        goToPrev,
        currentIndex,
        prevPage,
        nextPage
    } = useVerify();

    const [bgEndPageId, setBgEndPageId] = useState('');

    useEffect(() => {
        if (allPages.length > 0 && !bgEndPageId && currentIndex >= 0 && currentIndex < allPages.length - 1) {
            setBgEndPageId(allPages[allPages.length - 1]._id);
        }
    }, [allPages, bgEndPageId, currentIndex]);

    // Don't render header if no page loaded yet
    if (!page) {
        return null;
    }

    return (
        <>
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
                    {/* Actions & Navigation grouped */}
                    <div className="flex items-center gap-2">
                        {/* Model Dropdown */}
                        <select
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            disabled={processing || pageLoading}
                            className="bg-gray-700 text-white text-xs rounded px-2 py-1 h-[30px] border border-gray-600 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
                        >
                            <option value="gemini-3-flash-preview">⚡ Gemini 3 Flash</option>
                            <option value="gemma-4-31b-it">🧠 Gemma 4 (Thinking)</option>
                        </select>

                        {page.ocr_status !== 'verified' && (
                            <button
                                onClick={handleProcessOCR}
                                disabled={processing || pageLoading}
                                className="px-4 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm disabled:opacity-50 transition-colors h-[30px] flex items-center"
                            >
                                {processing ? (processingStatus || 'Processing...') : page.ocr_status === 'pending' ? '🔍 Process OCR' : '🔄 Re-process OCR'}
                            </button>
                        )}
                        
                        {/* BG Chain Controls */}
                        {nextPage && page.ocr_status !== 'verified' && (
                            <div className="flex items-center gap-1 ml-2 mr-2">
                                <span className="text-xs text-gray-400">To:</span>
                                <select
                                    value={bgEndPageId}
                                    onChange={(e) => setBgEndPageId(e.target.value)}
                                    disabled={bgRunning || processing || pageLoading}
                                    className="bg-gray-700 text-white text-xs rounded px-2 py-1 h-[30px] border border-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                                >
                                    {allPages
                                        .slice(currentIndex + 1)
                                        .map(p => (
                                            <option key={p._id} value={p._id}>
                                                Page {p.page_number}
                                            </option>
                                        ))
                                    }
                                </select>
                                <button
                                    onClick={() => startBgChain(bgEndPageId)}
                                    disabled={bgRunning || processing || !bgEndPageId || pageLoading}
                                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs h-[30px] flex items-center gap-1 disabled:opacity-50 transition-colors"
                                >
                                    ▶ BG Chain
                                </button>
                            </div>
                        )}

                        {/* Navigation - uses internal state, NO URL change */}
                        <button
                            onClick={goToPrev}
                            disabled={!prevPage || pageLoading}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white rounded text-sm transition-colors h-[30px]"
                        >
                            ← Prev
                        </button>
                        <span className="text-gray-400 text-sm min-w-[60px] text-center">
                            {currentIndex + 1} / {allPages.length}
                        </span>
                        <button
                            onClick={goToNext}
                            disabled={!nextPage || pageLoading}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white rounded text-sm transition-colors h-[30px]"
                        >
                            Next →
                        </button>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving || questions.length === 0 || !hasChanges() || pageLoading}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm disabled:opacity-50 transition-colors"
                    >
                        {saving ? 'Saving...' : '💾 Save & Verify'}
                    </button>
                </div>
            </header>

            {/* Continuation Alerts */}
            {page.continues_from_page && (
                <div className="bg-blue-900/30 border-b border-blue-700 px-4 py-2 text-blue-400 text-sm flex items-center justify-between">
                    <span>⬅️ This page has a merged question pushed forward from the previous page.</span>
                    <button
                        onClick={goToPrev}
                        className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs text-white"
                    >
                        Go to Previous Page
                    </button>
                </div>
            )}
            {page.continues_to_page && (
                <div className="bg-yellow-900/30 border-b border-yellow-700 px-4 py-2 text-yellow-400 text-sm flex items-center justify-between">
                    <span>➡️ This page had a cut-off question that was pushed forward to the next page.</span>
                    <button
                        onClick={goToNext}
                        className="px-3 py-1 bg-yellow-700 hover:bg-yellow-600 rounded text-xs text-white"
                    >
                        Go to Next Page
                    </button>
                </div>
            )}
        </>
    );
}

