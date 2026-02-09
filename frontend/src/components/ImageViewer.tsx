'use client';

/**
 * ImageViewer Component
 * Displays page image with zoom/pan capabilities and Cropping support
 */
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useState, useRef, useEffect, useMemo } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useVerify } from '@/context/VerifyContext';
import { getCroppedImg } from '@/utils/canvasUtils';

interface ImageViewerProps {
    imageUrl: string;
    pageNumber: number;
}

export default function ImageViewer({ imageUrl, pageNumber }: ImageViewerProps) {
    const [isLoading, setIsLoading] = useState(true);
    const { isCropMode, cancelCrop, completeCrop } = useVerify();

    // Crop state
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const imgRef = useRef<HTMLImageElement>(null);
    const transformComponentRef = useRef<any>(null);

    // Reset crop when mode changes
    useEffect(() => {
        if (!isCropMode) {
            setCrop(undefined);
            setCompletedCrop(undefined);
        } else {
            // Reset transform when entering crop mode to ensure 1:1 scaling for crop
            if (transformComponentRef.current) {
                const { resetTransform } = transformComponentRef.current;
                resetTransform();
            }
        }
    }, [isCropMode]);

    const handleConfirmCrop = async () => {
        if (completedCrop && imgRef.current) {
            // CRITICAL: Calculate scale because the image might be resized visually (object-contain)
            const image = imgRef.current;
            const scaleX = image.naturalWidth / image.width;
            const scaleY = image.naturalHeight / image.height;

            // Apply scale to the crop coordinates
            const scaledCrop: PixelCrop = {
                unit: 'px',
                x: completedCrop.x * scaleX,
                y: completedCrop.y * scaleY,
                width: completedCrop.width * scaleX,
                height: completedCrop.height * scaleY,
            };

            const blob = await getCroppedImg(image.src, scaledCrop);
            if (blob) {
                await completeCrop(blob);
            }
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-900 rounded-lg overflow-hidden relative">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 z-20">
                <span className="text-sm font-medium text-gray-300">
                    Page {pageNumber}
                </span>

                {isCropMode ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-yellow-400 font-bold animate-pulse">
                            ✂ CROP MODE
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={cancelCrop}
                                className="px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmCrop}
                                disabled={!completedCrop}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-2 text-xs text-gray-400">
                        <span>Scroll to zoom</span>
                        <span>•</span>
                        <span>Drag to pan</span>
                    </div>
                )}
            </div>

            {/* Image Container */}
            <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                )}

                {/* 
                   We use TransformWrapper for pan/zoom. 
                   When in crop mode, we disable interactions.
                   Crucially, we put ReactCrop INSIDE so it scales with the image if needed, 
                   BUT we forced resetTransform() on entry to crop mode so it should be 1:1.
                */}
                <TransformWrapper
                    ref={transformComponentRef}
                    initialScale={1}
                    minScale={0.1}
                    maxScale={5}
                    centerOnInit={true}
                    wheel={{ step: 0.1, disabled: isCropMode }}
                    panning={{ disabled: isCropMode }}
                    doubleClick={{ disabled: isCropMode }}
                    limitToBounds={false}
                >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                        <>
                            {/* Zoom Controls (Hidden in crop mode) */}
                            {!isCropMode && (
                                <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                                    <button
                                        onClick={() => zoomIn()}
                                        className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm font-bold shadow-lg"
                                        title="Zoom In"
                                    >
                                        +
                                    </button>
                                    <button
                                        onClick={() => zoomOut()}
                                        className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm font-bold shadow-lg"
                                        title="Zoom Out"
                                    >
                                        −
                                    </button>
                                    <button
                                        onClick={() => resetTransform()}
                                        className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs shadow-lg"
                                        title="Reset View"
                                    >
                                        ⟲
                                    </button>
                                </div>
                            )}

                            <TransformComponent
                                wrapperClass="!w-full !h-full"
                                contentClass="!w-full !h-full !flex !items-center !justify-center"
                            >
                                {isCropMode ? (
                                    <ReactCrop
                                        crop={crop}
                                        onChange={(c) => setCrop(c)}
                                        onComplete={(c) => setCompletedCrop(c)}
                                        className="max-w-full max-h-full"
                                        style={{
                                            // Ensure ReactCrop container doesn't exceed image dimensions visually
                                            // This helps align the crop overlay with the image if image is smaller than container
                                            // display: 'inline-block' or similar helps
                                        }}
                                    >
                                        <img
                                            ref={imgRef}
                                            src={`${imageUrl}?v=cors-fix`}
                                            alt={`Page ${pageNumber}`}
                                            className="block max-w-full max-h-full"
                                            onLoad={() => setIsLoading(false)}
                                            onError={() => setIsLoading(false)}
                                            crossOrigin="anonymous"
                                            style={{ maxHeight: 'calc(100vh - 200px)' }} // Limit height to prevent overflow
                                        />
                                    </ReactCrop>
                                ) : (
                                    <img
                                        src={`${imageUrl}?v=cors-fix`}
                                        alt={`Page ${pageNumber}`}
                                        className="block max-w-full max-h-full object-contain"
                                        onLoad={() => setIsLoading(false)}
                                        onError={() => setIsLoading(false)}
                                        crossOrigin="anonymous"
                                        style={{ display: 'block', maxHeight: 'calc(100vh - 200px)' }}
                                    />
                                )}
                            </TransformComponent>
                        </>
                    )}
                </TransformWrapper>
            </div>
        </div>
    );
}
