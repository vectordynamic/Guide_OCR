'use client';

/**
 * JsonPreview Component
 * Shows raw JSON from LLM OCR output
 */
import { useState } from 'react';
import { OCRResult } from '@/lib/types';

interface JsonPreviewProps {
    data: OCRResult | null;
    title?: string;
}

export default function JsonPreview({ data, title = 'Raw OCR JSON' }: JsonPreviewProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!data) {
        return (
            <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-400">
                No OCR data available. Click &quot;Process OCR&quot; to extract questions.
            </div>
        );
    }

    return (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-700 hover:bg-gray-600 transition-colors"
            >
                <span className="text-sm font-medium text-gray-300">{title}</span>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                        {data.questions?.length || 0} questions
                    </span>
                    <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                </div>
            </button>

            {isExpanded && (
                <div className="p-4 max-h-[300px] overflow-auto">
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
