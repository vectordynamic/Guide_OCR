'use client';

/**
 * VerifyHeader - Persistent header component for verification pages
 * Lives in layout so it never remounts during navigation
 * Uses internal state navigation (no URL changes)
 */
import Link from 'next/link';
import { useVerify } from '@/context/VerifyContext';

export default function VerifyHeader() {
    const {
        page,
        allPages,
        pageLoading,
        processing,
        processingStatus,
        saving,
        autoChain,
        autoChainStatus,
        setAutoChain,
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
                        {page.ocr_status !== 'verified' && (
                            <button
                                onClick={handleProcessOCR}
                                disabled={processing || pageLoading}
                                className="px-4 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm disabled:opacity-50 transition-colors h-[30px] flex items-center"
                            >
                                {processing ? (processingStatus || 'Processing...') : page.ocr_status === 'pending' ? '🔍 Process OCR' : '🔄 Re-process OCR'}
                            </button>
                        )}
                        
                        {/* Auto-Chain Toggle */}
                        <label className="flex items-center gap-2 cursor-pointer select-none ml-2 mr-2">
                            <div
                                onClick={() => setAutoChain(!autoChain)}
                                className={`relative w-10 h-5 rounded-full transition-colors duration-300 ease-in-out ${autoChain ? 'bg-green-500' : 'bg-gray-600'}`}
                            >
                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-300 ease-in-out ${autoChain ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </div>
                            <span className="text-xs text-gray-300">Auto-Chain</span>
                            {autoChain && autoChainStatus && (
                                <span className="text-xs text-green-400 bg-green-900/40 border border-green-700/50 px-2 py-0.5 rounded flex items-center gap-1 shadow-sm absolute top-full mt-1 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-50">
                                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                                    {autoChainStatus}
                                </span>
                            )}
                        </label>

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

