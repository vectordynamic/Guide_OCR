'use client';

import { useVerify } from '@/context/VerifyContext';

export default function BgChainBadge() {
    const { bgRunning, bgCurrentPageNum, bgEndPageNum, bgTotalCount, stopBgChain } = useVerify();

    if (!bgRunning) return null;

    const doneCount = bgTotalCount - (bgEndPageNum - bgCurrentPageNum);
    const percent = Math.min(100, Math.round((doneCount / bgTotalCount) * 100));

    return (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 border border-indigo-700 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 min-w-[260px]">
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse flex-shrink-0" />
            <div className="flex-1">
                <div className="text-xs text-indigo-300 font-medium mb-1">
                    Background OCR — Page {bgCurrentPageNum} → {bgEndPageNum}
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">{doneCount}/{bgTotalCount} pages</div>
            </div>
            <button
                onClick={stopBgChain}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-800 hover:bg-red-900/30 transition-colors flex-shrink-0"
            >
                ■ Stop
            </button>
        </div>
    );
}
