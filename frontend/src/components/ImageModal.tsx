'use client';

import { useEffect } from 'react';

interface ImageModalProps {
    src: string;
    alt?: string;
    onClose: () => void;
}

export default function ImageModal({ src, alt, onClose }: ImageModalProps) {
    // Close on ESC key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div className="relative max-w-7xl max-h-[90vh] flex flex-col items-center">
                <button
                    onClick={onClose}
                    className="absolute -top-10 right-0 text-white hover:text-gray-300 text-xl font-bold p-2"
                >
                    ✕ Close
                </button>
                <img
                    src={src}
                    alt={alt || 'Preview'}
                    className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl border border-gray-700"
                    onClick={(e) => e.stopPropagation()} // Prevent close when clicking image
                />
            </div>
        </div>
    );
}
