'use client';

/**
 * Chapter Detail - Pages Grid
 */
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getChapter, getChapterPages, processPageOCR } from '@/lib/api';
import { Chapter, OCRPage } from '@/lib/types';

export default function ChapterDetailPage() {
    const params = useParams();
    const chapterId = params.id as string;

    const [chapter, setChapter] = useState<Chapter | null>(null);
    const [pages, setPages] = useState<OCRPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingAll, setProcessingAll] = useState(false);

    useEffect(() => {
        loadData();
    }, [chapterId]);

    const loadData = async () => {
        try {
            const [chapterRes, pagesRes] = await Promise.all([
                getChapter(chapterId),
                getChapterPages(chapterId)
            ]);
            setChapter(chapterRes.data);
            setPages(pagesRes.data);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const processAllPages = async () => {
        setProcessingAll(true);
        const pendingPages = pages.filter(p => p.ocr_status === 'pending');

        for (const page of pendingPages) {
            try {
                await processPageOCR(page._id);
                setPages(prev => prev.map(p =>
                    p._id === page._id ? { ...p, ocr_status: 'completed' } : p
                ));
            } catch (error) {
                console.error(`Failed to process page ${page.page_number}:`, error);
            }
        }
        setProcessingAll(false);
        loadData();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'verified': return 'bg-green-500';
            case 'completed': return 'bg-blue-500';
            case 'processing': return 'bg-yellow-500 animate-pulse';
            default: return 'bg-gray-500';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin text-4xl">⟳</div>
            </div>
        );
    }

    if (!chapter) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <p className="text-gray-400">Chapter not found</p>
            </div>
        );
    }

    const pendingCount = pages.filter(p => p.ocr_status === 'pending').length;
    const completedCount = pages.filter(p => p.ocr_status === 'completed').length;
    const verifiedCount = pages.filter(p => p.ocr_status === 'verified').length;

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12">
            <div className="max-w-7xl mx-auto px-4">
                {/* Breadcrumb */}
                <div className="mb-6">
                    <Link href={`/books/${chapter.book_id}`} className="text-gray-400 hover:text-white text-sm">
                        ← Back to Chapters
                    </Link>
                </div>

                {/* Chapter Header */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-2">
                                Chapter {chapter.chapter_num}: {chapter.title}
                            </h1>
                            <p className="text-gray-400">
                                Pages {chapter.start_page} - {chapter.end_page} ({chapter.total_pages} pages)
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* Stats */}
                            <div className="flex gap-3 text-sm">
                                <span className="px-3 py-1 bg-gray-700 rounded text-gray-300">
                                    Pending: {pendingCount}
                                </span>
                                <span className="px-3 py-1 bg-blue-900/30 rounded text-blue-400">
                                    Completed: {completedCount}
                                </span>
                                <span className="px-3 py-1 bg-green-900/30 rounded text-green-400">
                                    Verified: {verifiedCount}
                                </span>
                            </div>
                            {/* Process All */}
                            {pendingCount > 0 && (
                                <button
                                    onClick={processAllPages}
                                    disabled={processingAll}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50"
                                >
                                    {processingAll ? 'Processing...' : `Process All (${pendingCount})`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Pages Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {pages.map((page) => (
                        <Link
                            key={page._id}
                            href={`/verify/${page._id}`}
                            className="group relative bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-blue-500 transition-colors"
                        >
                            {/* Thumbnail */}
                            <div className="aspect-[3/4] bg-gray-700 relative">
                                <img
                                    src={page.image_url}
                                    alt={`Page ${page.page_number}`}
                                    className="w-full h-full object-cover"
                                />
                                {/* Status Indicator */}
                                <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${getStatusColor(page.ocr_status)}`} />

                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white font-medium">Open</span>
                                </div>
                            </div>

                            {/* Page Number */}
                            <div className="p-2 text-center">
                                <span className="text-sm text-gray-300">Page {page.page_number}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </main>
    );
}
