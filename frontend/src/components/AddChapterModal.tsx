'use client';

import { useState } from 'react';
import { addChapter } from '@/lib/api';

interface AddChapterModalProps {
    bookId: string;
    nextChapterNum: number;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddChapterModal({ bookId, nextChapterNum, onClose, onSuccess }: AddChapterModalProps) {
    const [title, setTitle] = useState('');
    const [chapterNum, setChapterNum] = useState(nextChapterNum);
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            setError('Please select a PDF file');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('title', title);
            formData.append('chapter_num', chapterNum.toString());

            await addChapter(bookId, formData);
            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            setError('Failed to add chapter. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-4">Add New Chapter</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Chapter Number</label>
                        <input
                            type="number"
                            value={chapterNum}
                            onChange={(e) => setChapterNum(parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Chapter Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Thermodynamics"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">PDF File</label>
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                            required
                        />
                    </div>

                    {error && (
                        <div className="text-red-400 text-sm bg-red-900/20 border border-red-900/50 p-2 rounded">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <span className="animate-spin">⟳</span> Adding...
                                </>
                            ) : (
                                'Add Chapter'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
