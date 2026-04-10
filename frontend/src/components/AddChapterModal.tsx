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
    const [uploadMode, setUploadMode] = useState<'pdf' | 'images'>('pdf');
    const [isFolderMode, setIsFolderMode] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (uploadMode === 'pdf' && !file) {
            setError('Please select a PDF file');
            return;
        }
        if (uploadMode === 'images' && imageFiles.length === 0) {
            setError(isFolderMode ? 'Please select a folder containing images' : 'Please select at least one image');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const formData = new FormData();
            if (uploadMode === 'pdf' && file) {
                formData.append('file', file);
            } else if (uploadMode === 'images') {
                imageFiles.forEach(f => {
                    formData.append('image_files', f);
                });
            }
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
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">Add New Chapter</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">✕</button>
                </div>

                {/* Upload Mode Toggle */}
                <div className="flex bg-gray-700/50 p-1 rounded-lg mb-6">
                    <button
                        type="button"
                        onClick={() => { setUploadMode('pdf'); setError(''); setFile(null); setImageFiles([]); }}
                        className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                            uploadMode === 'pdf' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        📄 PDF
                    </button>
                    <button
                        type="button"
                        onClick={() => { setUploadMode('images'); setError(''); setFile(null); setImageFiles([]); }}
                        className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                            uploadMode === 'images' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        🖼️ Images
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-300 mb-1">Number</label>
                            <input
                                type="number"
                                value={chapterNum}
                                onChange={(e) => setChapterNum(parseInt(e.target.value))}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                        <div className="col-span-2">
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
                    </div>

                    <div className="pt-2">
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-medium text-gray-300">
                                {uploadMode === 'pdf' ? 'PDF File' : 'Chapter Images'}
                            </label>
                            
                            {uploadMode === 'images' && (
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <span className="text-[10px] uppercase tracking-wider text-gray-500 group-hover:text-blue-400 transition-colors">Folder Mode</span>
                                    <div 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setIsFolderMode(!isFolderMode);
                                            setImageFiles([]);
                                        }}
                                        className={`w-8 h-4 rounded-full relative transition-colors ${isFolderMode ? 'bg-blue-600' : 'bg-gray-600'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isFolderMode ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </div>
                                </label>
                            )}
                        </div>

                        <div className="relative group">
                            <input
                                key={`${uploadMode}-${isFolderMode}`}
                                type="file"
                                accept={uploadMode === 'pdf' ? ".pdf" : "image/*"}
                                multiple={uploadMode === 'images' && !isFolderMode}
                                {...(uploadMode === 'images' && isFolderMode ? { 
                                    webkitdirectory: "", 
                                    directory: "" 
                                } as any : {})}
                                onChange={(e) => {
                                    if (uploadMode === 'pdf') {
                                        setFile(e.target.files?.[0] || null);
                                    } else {
                                        setImageFiles(Array.from(e.target.files || []));
                                    }
                                }}
                                className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-blue-400 hover:file:bg-gray-600 file:cursor-pointer cursor-pointer border border-dashed border-gray-600 rounded-lg p-2 hover:border-blue-500/50 transition-colors"
                                required
                            />
                            {uploadMode === 'images' && imageFiles.length > 0 && (
                                <div className="flex items-center gap-2 mt-2 px-1">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                    <p className="text-xs text-green-400 font-medium">{imageFiles.length} images ready to process</p>
                                </div>
                            )}
                        </div>
                        {uploadMode === 'images' && isFolderMode && (
                            <p className="text-[10px] text-gray-500 mt-2 px-1 italic">
                                * Folder images will be sorted alphabetically (e.g. 01.jpg, 02.jpg...)
                            </p>
                        )}
                    </div>

                    {error && (
                        <div className="text-red-400 text-xs bg-red-900/10 border border-red-900/30 p-2 rounded flex items-center gap-2">
                            <span>⚠️</span> {error}
                        </div>
                    )}

                    <div className="flex gap-3 mt-6 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || (uploadMode === 'pdf' ? !file : imageFiles.length === 0)}
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-blue-900/20"
                        >
                            {loading ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Processing...
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

