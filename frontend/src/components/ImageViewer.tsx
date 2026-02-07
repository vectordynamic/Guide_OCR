'use client';

/**
 * ImageViewer Component
 * Displays page image with zoom/pan capabilities
 */
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useState } from 'react';

interface ImageViewerProps {
    imageUrl: string;
    pageNumber: number;
}

export default function ImageViewer({ imageUrl, pageNumber }: ImageViewerProps) {
    const [isLoading, setIsLoading] = useState(true);

    return (
        <div className="h-full flex flex-col bg-gray-900 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                <span className="text-sm font-medium text-gray-300">
                    Page {pageNumber}
                </span>
                <div className="flex gap-2 text-xs text-gray-400">
                    <span>Scroll to zoom</span>
                    <span>•</span>
                    <span>Drag to pan</span>
                </div>
            </div>

            {/* Image Container */}
            <div className="flex-1 relative">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                )}

                <TransformWrapper
                    initialScale={1}
                    minScale={0.5}
                    maxScale={4}
                    centerOnInit
                >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                        <>
                            {/* Zoom Controls */}
                            <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                                <button
                                    onClick={() => zoomIn()}
                                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
                                    title="Zoom In"
                                >
                                    +
                                </button>
                                <button
                                    onClick={() => zoomOut()}
                                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
                                    title="Zoom Out"
                                >
                                    −
                                </button>
                                <button
                                    onClick={() => resetTransform()}
                                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs"
                                    title="Reset"
                                >
                                    ⟲
                                </button>
                            </div>

                            <TransformComponent
                                wrapperStyle={{ width: '100%', height: '100%' }}
                                contentStyle={{ width: '100%', height: '100%' }}
                            >
                                <img
                                    src={imageUrl}
                                    alt={`Page ${pageNumber}`}
                                    className="max-w-full max-h-full object-contain mx-auto"
                                    onLoad={() => setIsLoading(false)}
                                    onError={() => setIsLoading(false)}
                                />
                            </TransformComponent>
                        </>
                    )}
                </TransformWrapper>
            </div>
        </div>
    );
}
