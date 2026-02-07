'use client';

/**
 * Books List Page
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getBooks, deleteBook } from '@/lib/api';
import { Book } from '@/lib/types';

export default function BooksPage() {
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadBooks();
    }, []);

    const loadBooks = async () => {
        try {
            const response = await getBooks();
            setBooks(response.data);
        } catch (error) {
            console.error('Failed to load books:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this book and all its data?')) return;
        try {
            await deleteBook(id);
            setBooks(books.filter(b => b._id !== id));
        } catch (error) {
            console.error('Failed to delete book:', error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="animate-spin text-4xl">⟳</div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12">
            <div className="max-w-6xl mx-auto px-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold text-white">📚 Books</h1>
                    <Link
                        href="/"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                    >
                        + Upload New
                    </Link>
                </div>

                {/* Books Grid */}
                {books.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-gray-400 text-lg mb-4">No books uploaded yet</p>
                        <Link href="/" className="text-blue-400 hover:text-blue-300">
                            Upload your first book →
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {books.map((book) => (
                            <div
                                key={book._id}
                                className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden hover:border-blue-500 transition-colors group"
                            >
                                {/* Cover */}
                                <div className="h-48 bg-gradient-to-br from-blue-900/50 to-purple-900/50 flex items-center justify-center">
                                    {book.cover_image_url ? (
                                        <img
                                            src={book.cover_image_url}
                                            alt={book.title}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-6xl">📖</span>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="p-4">
                                    <h3 className="text-lg font-semibold text-white mb-1 truncate">
                                        {book.title}
                                    </h3>
                                    <p className="text-gray-400 text-sm mb-3">
                                        {book.subject} • {book.class_name}
                                    </p>
                                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                                        <span>{book.total_pages} pages</span>
                                        <span>{book.total_chapters} chapters</span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <Link
                                            href={`/books/${book._id}`}
                                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-center rounded-lg text-sm transition-colors"
                                        >
                                            Open Chapters
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(book._id)}
                                            className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-sm transition-colors"
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
