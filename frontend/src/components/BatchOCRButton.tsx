'use client';

import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';

interface BatchOCRButtonProps {
    chapterId: string;
    chapterTitle: string;
    onComplete?: () => void;
}

export default function BatchOCRButton({ chapterId, chapterTitle, onComplete }: BatchOCRButtonProps) {
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState<{
        processed: number;
        total: number;
        failed: number;
    } | null>(null);

    const pollInterval = useRef<NodeJS.Timeout | null>(null);

    // Polling function
    const checkProgress = async () => {
        try {
            const res = await api.get(`/chapters/${chapterId}/pages`);
            const pages = res.data;
            const total = pages.length;
            // Count how many are done
            const completed = pages.filter((p: any) =>
                ['completed', 'verified'].includes(p.ocr_status)
            ).length;

            setProgress({ processed: completed, total, failed: 0 });
        } catch (e) {
            console.error("Polling error", e);
        }
    };

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (pollInterval.current) {
                clearInterval(pollInterval.current);
            }
        };
    }, []);

    // START BATCH
    const handleStartBatch = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm(`Start Batch OCR for "${chapterTitle}"?\nThis process may take a minute.`)) return;

        setProcessing(true);
        // Initial check
        await checkProgress();

        // Start polling every 2s
        const interval = setInterval(checkProgress, 2000);
        pollInterval.current = interval;

        try {
            const res = await api.post(`/chapters/${chapterId}/process`);
            const { processed_count, failed_count, total_pages } = res.data;

            // Final update
            if (pollInterval.current) clearInterval(pollInterval.current);
            await checkProgress(); // Ensure 100% if done

            alert(
                `Batch Complete!\n` +
                `Processed: ${processed_count}\n` +
                `Failed: ${failed_count}\n` +
                `Total Pages: ${total_pages}`
            );

            if (onComplete) onComplete();
        } catch (error: any) {
            console.error(error);
            alert('Batch processing failed or timed out.');
        } finally {
            if (pollInterval.current) clearInterval(pollInterval.current);
            setProcessing(false);
            setProgress(null);
        }
    };

    // Render Progress Bar while processing
    if (processing && progress) {
        const percent = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
        return (
            <div className="w-32 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden border border-gray-600">
                    <div
                        className="h-full bg-green-500 transition-all duration-500 ease-out"
                        style={{ width: `${percent}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                    <span>{percent}%</span>
                    <span>{progress.processed}/{progress.total}</span>
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={handleStartBatch}
            disabled={processing}
            className={`
                px-3 py-1 rounded text-xs font-medium transition-colors
                ${processing
                    ? 'bg-yellow-900/50 text-yellow-200 cursor-wait'
                    : 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 border border-blue-800'
                }
            `}
        >
            ⚡ Batch OCR
        </button>
    );
}
