'use client';

/**
 * Book Detail - Chapters List
 */
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getBook, getChapters } from '@/lib/api';
import { Book, Chapter } from '@/lib/types';

export default function BookDetailPage() {
    const params = useParams();
    const bookId = params.id as string;

    const [book, setBook] = useState<Book | null>(null);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [bookId]);

    const loadData = async () => {
        try {
            const [bookRes, chaptersRes] = await Promise.all([
                getBook(bookId),
                getChapters(bookId)
            ]);
            setBook(bookRes.data);
            setChapters(chaptersRes.data);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'verified': return 'bg-green-900/30 text-green-400 border-green-700';
            case 'completed': return 'bg-blue-900/30 text-blue-400 border-blue-700';
            case 'processing': return 'bg-yellow-900/30 text-yellow-400 border-yellow-700';
            default: return 'bg-gray-700/30 text-gray-400 border-gray-600';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin text-4xl">⟳</div>
            </div>
        );
    }

    if (!book) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <p className="text-gray-400">Book not found</p>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12">
            <div className="max-w-6xl mx-auto px-4">
                {/* Breadcrumb */}
                <div className="mb-6">
                    <Link href="/books" className="text-gray-400 hover:text-white text-sm">
                        ← Back to Books
                    </Link>
                </div>

                {/* Book Header */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-8">
                    <div className="flex items-start gap-6">
                        <div className="w-24 h-32 bg-gradient-to-br from-blue-900/50 to-purple-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                            {book.cover_image_url ? (
                                <img src={book.cover_image_url} alt={book.title} className="w-full h-full object-cover rounded-lg" />
                            ) : (
                                <span className="text-4xl">📖</span>
                            )}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-2">{book.title}</h1>
                            <p className="text-gray-400 mb-4">{book.subject} • {book.class_name} • {book.author}</p>
                            <div className="flex gap-6 text-sm text-gray-500">
                                <span>{book.total_pages} pages</span>
                                <span>{book.total_chapters} chapters</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chapters List */}
                <h2 className="text-xl font-semibold text-white mb-4">Chapters</h2>
                <div className="space-y-3">
                    {chapters.map((chapter) => (
                        <Link
                            key={chapter._id}
                            href={`/chapters/${chapter._id}`}
                            className="block bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-blue-500 transition-colors group"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <span className="text-2xl font-bold text-blue-400 w-12">
                                        {chapter.chapter_num}
                                    </span>
                                    <div>
                                        <h3 className="text-lg font-medium text-white group-hover:text-blue-300 transition-colors">
                                            {chapter.title}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            Pages {chapter.start_page} - {chapter.end_page} ({chapter.total_pages} pages)
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`px-3 py-1 rounded-full text-xs border ${getStatusColor(chapter.ocr_status)}`}>
                                        {chapter.ocr_status}
                                    </span>
                                    <span className="text-gray-500 group-hover:text-white transition-colors">→</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </main>
    );
}
