'use client';

/**
 * QuestionForm Component
 * Visually rich, type-specific form for question data
 */
import { useState, useEffect } from 'react';
import { Question, QuestionType, BoardAppearance, BOARDS } from '@/lib/types';
import { useVerify, CropTarget } from '@/context/VerifyContext';
import ImageModal from './ImageModal';

interface QuestionFormProps {
    question: Question;
    index: number;
    onChange: (index: number, question: Question) => void;
    onDelete: (index: number) => void;
}

export default function QuestionForm({ question, index, onChange, onDelete }: QuestionFormProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [showMetadata, setShowMetadata] = useState(false);
    const [localQuestion, setLocalQuestion] = useState<Question>(question);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const { startCrop } = useVerify();

    useEffect(() => {
        setLocalQuestion(question);
    }, [question]);

    const handleChange = (field: string, value: unknown) => {
        const updated = { ...localQuestion, [field]: value };
        setLocalQuestion(updated);
        onChange(index, updated);
    };

    const handleAppearanceChange = (appIndex: number, field: keyof BoardAppearance, value: string) => {
        const appearances = [...(localQuestion.metadata?.appearances || [])];
        appearances[appIndex] = { ...appearances[appIndex], [field]: value };
        const updated = {
            ...localQuestion,
            metadata: { ...localQuestion.metadata, appearances }
        };
        setLocalQuestion(updated);
        onChange(index, updated);
    };

    const addAppearance = () => {
        const appearances = [...(localQuestion.metadata?.appearances || []), { board: '', exam_year: '', school_name: '' }];
        const updated = {
            ...localQuestion,
            metadata: { ...localQuestion.metadata, appearances }
        };
        setLocalQuestion(updated);
        onChange(index, updated);
    };

    const removeAppearance = (appIndex: number) => {
        const appearances = (localQuestion.metadata?.appearances || []).filter((_, i) => i !== appIndex);
        const updated = {
            ...localQuestion,
            metadata: { ...localQuestion.metadata, appearances }
        };
        setLocalQuestion(updated);
        onChange(index, updated);
    };

    const handleMetadataChange = (field: string, value: string) => {
        const updated = {
            ...localQuestion,
            metadata: { ...localQuestion.metadata, [field]: value }
        };
        setLocalQuestion(updated);
        onChange(index, updated);
    };

    const handleOptionsChange = (key: string, value: string) => {
        const updated = {
            ...localQuestion,
            options: { ...localQuestion.options, [key]: value } as Question['options']
        };
        setLocalQuestion(updated);
        onChange(index, updated);
    };

    const handleSubQuestionChange = (subIndex: number, field: string, value: string) => {
        const subQuestions = [...(localQuestion.sub_questions || [])];
        subQuestions[subIndex] = { ...subQuestions[subIndex], [field]: value };
        handleChange('sub_questions', subQuestions);
    };

    const addHint = (hint: string) => {
        if (!hint.trim()) return;
        const hints = [...(localQuestion.hints || []), hint.trim()];
        handleChange('hints', hints);
    };

    const removeHint = (hintIndex: number) => {
        const hints = (localQuestion.hints || []).filter((_, i) => i !== hintIndex);
        handleChange('hints', hints);
    };

    // Check completion status
    const isComplete = () => {
        if (!localQuestion.question_text?.trim()) return false;
        if (localQuestion.type === 'mcq') {
            return localQuestion.correct_answer &&
                localQuestion.options?.ka &&
                localQuestion.options?.kha &&
                localQuestion.options?.ga &&
                localQuestion.options?.gha;
        }
        return true;
    };

    // Helper for Image Crop Button
    const renderCropButton = (
        label: string,
        imageUrl: string | undefined,
        target: CropTarget
    ) => (
        <div className="flex flex-col gap-1.5 mt-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
            <div className="flex items-center gap-3">
                {imageUrl && (
                    <div className="relative group">
                        <img
                            src={imageUrl}
                            alt="Crop preview"
                            className="h-12 w-12 object-cover rounded border border-gray-600 bg-black cursor-pointer hover:scale-150 transition-transform origin-bottom-left z-10"
                            onClick={() => setPreviewImage(imageUrl)}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded pointer-events-none">
                            <span className="text-[10px] text-white">View</span>
                        </div>
                    </div>
                )}
                <button
                    onClick={() => startCrop(target)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/30 hover:bg-blue-800/40 text-blue-300 text-xs rounded border border-blue-500/30 transition-colors"
                    title="Select area from the page"
                >
                    <span>✂</span>
                    <span>{imageUrl ? 'Change Image' : 'Select Area'}</span>
                </button>
            </div>
        </div>
    );

    // Type-specific colors and icons
    const typeConfig = {
        mcq: {
            color: 'emerald',
            icon: '✓',
            label: 'MCQ',
            bgClass: 'bg-emerald-900/20',
            borderClass: 'border-emerald-500/30',
            textClass: 'text-emerald-400'
        },
        creative: {
            color: 'purple',
            icon: '📝',
            label: 'CREATIVE',
            bgClass: 'bg-purple-900/20',
            borderClass: 'border-purple-500/30',
            textClass: 'text-purple-400'
        },
        short: {
            color: 'amber',
            icon: '💬',
            label: 'SHORT',
            bgClass: 'bg-amber-900/20',
            borderClass: 'border-amber-500/30',
            textClass: 'text-amber-400'
        }
    };

    const config = typeConfig[localQuestion.type] || typeConfig.short;

    return (
        <>
            <div className={`border ${config.borderClass} rounded-lg ${config.bgClass} overflow-hidden transition-all duration-300 hover:shadow-lg`}>
                {/* Header */}
                <div
                    className="flex items-center justify-between px-4 py-3 bg-gray-800/80 backdrop-blur-sm cursor-pointer hover:bg-gray-800"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-3">
                        <span className={`text-lg ${config.textClass}`}>{config.icon}</span>
                        <span className={`text-xs font-bold ${config.textClass} px-3 py-1.5 rounded-full ${config.bgClass} border ${config.borderClass}`}>
                            {config.label}
                        </span>
                        <span className="text-sm font-semibold text-white bg-gray-700 px-2.5 py-1 rounded">
                            {localQuestion.metadata?.question_number ? `#${localQuestion.metadata.question_number}` : `Q${index + 1}`}
                        </span>
                        {localQuestion.spans_pages && localQuestion.spans_pages.length > 1 && (
                            <span className="text-xs font-bold text-blue-300 px-2 py-1 bg-blue-900/40 border border-blue-700/50 rounded flex items-center gap-1" title={`Spans across pages: ${localQuestion.spans_pages.join(', ')}`}>
                                🔗 {localQuestion.spans_pages.length} Pages
                            </span>
                        )}
                        <span className={`w-2 h-2 rounded-full ${isComplete() ? 'bg-green-400' : 'bg-red-400'}`}
                            title={isComplete() ? 'Complete' : 'Incomplete'} />
                        <span className="text-sm text-gray-300 truncate max-w-[400px]">
                            {localQuestion.question_text?.substring(0, 60) || 'New Question'}...
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(index); }}
                            className="text-red-400 hover:text-red-300 text-sm px-3 py-1.5 rounded hover:bg-red-900/20 transition-colors"
                        >
                            🗑️ Delete
                        </button>
                        <span className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                </div>

                {/* Form Fields */}
                {isExpanded && (
                    <div className="p-6 space-y-6">
                        {/* Type Selector & Settings */}
                        <div className="flex gap-4 items-start">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Question Type</label>
                                <select
                                    value={localQuestion.type}
                                    onChange={(e) => handleChange('type', e.target.value as QuestionType)}
                                    className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="mcq">✓ Multiple Choice (MCQ)</option>
                                    <option value="short">💬 Short Question</option>
                                    <option value="creative">📝 Creative Question (CQ)</option>
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Has Image?</label>
                                <select
                                    value={localQuestion.has_image ? 'true' : 'false'}
                                    onChange={(e) => handleChange('has_image', e.target.value === 'true')}
                                    className="w-full px-4 py-2.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="false">📄 No Image</option>
                                    <option value="true">📷 Has Image</option>
                                </select>
                            </div>
                        </div>

                        {/* Question Text */}
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">
                                    {localQuestion.type === 'creative' ? '📝 Stem Question (Main Question)' : '❓ Question Text'}
                                </label>
                                <textarea
                                    value={localQuestion.question_text || ''}
                                    onChange={(e) => handleChange('question_text', e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-base leading-relaxed resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Enter the main question text here..."
                                />
                            </div>

                            {/* Question Image (Stem) */}
                            {localQuestion.has_image && renderCropButton(
                                "Question Image (Stem)",
                                localQuestion.image_url,
                                { index, type: 'question', field: 'image_url' }
                            )}
                        </div>

                        {/* Image Description */}
                        {localQuestion.has_image && (
                            <div className="bg-blue-900/10 border border-blue-500/30 rounded-lg p-4">
                                <label className="flex items-center gap-2 text-sm font-semibold text-blue-400 mb-2">
                                    <span>📷</span> Image Description
                                </label>
                                <textarea
                                    value={localQuestion.image_description || ''}
                                    onChange={(e) => handleChange('image_description', e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Describe the diagram, chart, or image shown in the question..."
                                />
                            </div>
                        )}

                        {/* TYPE-SPECIFIC LAYOUTS */}

                        {/* MCQ Layout */}
                        {localQuestion.type === 'mcq' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-semibold text-gray-300">✓ Answer Options</label>
                                    <span className="text-xs text-gray-500">Click the card to mark as correct answer</span>
                                </div>
                                <div className="space-y-3">
                                    {['ka', 'kha', 'ga', 'gha'].map((key) => {
                                        const isCorrect = localQuestion.correct_answer === key;
                                        return (
                                            <div
                                                key={key}
                                                onClick={() => handleChange('correct_answer', key)}
                                                className={`relative group cursor-pointer transition-all duration-200 ${isCorrect
                                                    ? 'bg-emerald-900/30 border-2 border-emerald-500 shadow-lg shadow-emerald-500/20'
                                                    : 'bg-gray-700/30 border-2 border-gray-600 hover:border-gray-500 hover:bg-gray-700/50'
                                                    } rounded-lg p-4`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${isCorrect ? 'border-emerald-400 bg-emerald-500/20' : 'border-gray-500 bg-gray-800'
                                                        }`}>
                                                        {isCorrect && <span className="text-emerald-400 text-lg">✓</span>}
                                                    </div>
                                                    <span className={`font-bold text-sm ${isCorrect ? 'text-emerald-400' : 'text-gray-400'} min-w-[40px]`}>
                                                        {key})
                                                    </span>
                                                    <input
                                                        type="text"
                                                        value={localQuestion.options?.[key] || ''}
                                                        onChange={(e) => handleOptionsChange(key, e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                        placeholder={`Enter option ${key}...`}
                                                    />
                                                </div>
                                                {isCorrect && (
                                                    <div className="absolute top-2 right-2 text-xs bg-emerald-500 text-white px-2 py-1 rounded-full">
                                                        Correct Answer
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Short Question Layout */}
                        {localQuestion.type === 'short' && (
                            <div className="bg-gray-700/20 border border-gray-600 rounded-lg p-5 space-y-4">
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-semibold text-amber-400 mb-3">
                                        <span>💡</span> Answer
                                    </label>
                                    <textarea
                                        value={localQuestion.answer || ''}
                                        onChange={(e) => handleChange('answer', e.target.value)}
                                        rows={4}
                                        className="w-full px-4 py-3 bg-gray-800/50 border border-gray-600 rounded-lg text-white text-base leading-relaxed resize-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                        placeholder="Enter the answer if visible in the source material..."
                                    />
                                </div>

                                {/* Short Question Answer Image */}
                                {renderCropButton(
                                    "Answer Image",
                                    localQuestion.answer_image_url,
                                    { index, type: 'question', field: 'answer_image_url' }
                                )}
                            </div>
                        )}

                        {/* Creative Question Layout */}
                        {localQuestion.type === 'creative' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-purple-500/30">
                                    <span className="text-sm font-semibold text-purple-400">📝 Sub-Questions</span>
                                    <span className="text-xs text-gray-500 ml-auto">
                                        {(localQuestion.sub_questions || []).filter(sq => sq?.text?.trim()).length} / 4 completed
                                    </span>
                                </div>

                                <div className="space-y-3 pl-4 border-l-2 border-purple-500/30">
                                    {['ka', 'kha', 'ga', 'gha'].map((key, i) => {
                                        const subQ = localQuestion.sub_questions?.[i] || { index: key, text: '', answer: '' };
                                        const hasContent = subQ?.text?.trim();

                                        return (
                                            <div
                                                key={key}
                                                className={`relative bg-gray-700/20 border ${hasContent ? 'border-purple-500/40' : 'border-gray-600'
                                                    } rounded-lg p-4 transition-all duration-200`}
                                            >
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="font-bold text-purple-400 text-sm min-w-[50px]">
                                                        {key})
                                                    </span>
                                                    {hasContent && (
                                                        <span className="w-2 h-2 bg-green-400 rounded-full" title="Has content" />
                                                    )}
                                                </div>

                                                <div className="space-y-3 pl-2">
                                                    <div className="flex gap-4">
                                                        <div className="flex-1">
                                                            <label className="block text-xs text-gray-400 mb-1.5">Question:</label>
                                                            <input
                                                                type="text"
                                                                value={subQ?.text || ''}
                                                                onChange={(e) => handleSubQuestionChange(i, 'text', e.target.value)}
                                                                placeholder={`Enter sub-question ${key}...`}
                                                                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                            />
                                                        </div>
                                                        <div className="w-24">
                                                            <label className="block text-xs text-gray-400 mb-1.5">Mark:</label>
                                                            <input
                                                                type="number"
                                                                value={subQ?.mark || ''}
                                                                onChange={(e) => handleSubQuestionChange(i, 'mark', e.target.value)}
                                                                placeholder="1"
                                                                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs text-gray-400 mb-1.5">Answer (if visible):</label>
                                                        <textarea
                                                            value={subQ?.answer || ''}
                                                            onChange={(e) => handleSubQuestionChange(i, 'answer', e.target.value)}
                                                            placeholder="Enter answer if available..."
                                                            rows={2}
                                                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                        />
                                                    </div>

                                                    {/* Sub-Question Answer Image */}
                                                    {renderCropButton(
                                                        "Sub-Question Answer Image",
                                                        subQ.answer_image_url,
                                                        {
                                                            index,
                                                            type: 'sub_question',
                                                            subIndex: i,
                                                            field: 'answer_image_url'
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Hints Section - Available for all question types */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-300 mb-2">💡 Hints</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {(localQuestion.hints || []).map((hint, i) => (
                                    <div
                                        key={i}
                                        className="group flex items-center gap-2 bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/40 text-blue-300 px-3 py-1.5 rounded-full text-sm"
                                    >
                                        <span>{hint}</span>
                                        <button
                                            onClick={() => removeHint(i)}
                                            className="text-blue-400 hover:text-blue-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <input
                                type="text"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        addHint(e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Type a hint and press Enter to add..."
                            />
                        </div>

                        {/* Metadata Section - Collapsible */}
                        <div className="border-t border-gray-700 pt-4">
                            <button
                                onClick={() => setShowMetadata(!showMetadata)}
                                className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-gray-300 transition-colors mb-3"
                            >
                                <span className={`transition-transform duration-200 ${showMetadata ? 'rotate-90' : ''}`}>▶</span>
                                <span>📋 Metadata & Additional Info</span>
                            </button>

                            {showMetadata && (
                                <div className="space-y-4 bg-gray-800/30 rounded-lg p-4 border border-gray-700">
                                    {/* Question Number */}
                                    <div className="mb-4">
                                        <label className="block text-xs text-gray-500 mb-1.5">Question Number</label>
                                        <input
                                            type="text"
                                            value={localQuestion.metadata?.question_number || ''}
                                            onChange={(e) => handleMetadataChange('question_number', e.target.value)}
                                            className="w-40 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:ring-2 focus:ring-blue-500"
                                            placeholder="1, 2, 3..."
                                        />
                                    </div>

                                    {/* Board Appearances */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Board Appearances</label>
                                            <button
                                                onClick={addAppearance}
                                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                            >
                                                + Add Board
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {(localQuestion.metadata?.appearances || []).length === 0 && (
                                                <p className="text-xs text-gray-600 italic">No board appearances added yet.</p>
                                            )}
                                            {(localQuestion.metadata?.appearances || []).map((app, appIdx) => (
                                                <div key={appIdx} className="flex items-center gap-2 bg-gray-700/40 p-2 rounded-lg border border-gray-600">
                                                    <select
                                                        value={app.board || ''}
                                                        onChange={(e) => handleAppearanceChange(appIdx, 'board', e.target.value)}
                                                        className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="">Select Board...</option>
                                                        {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
                                                    </select>
                                                    <input
                                                        type="text"
                                                        value={app.exam_year || ''}
                                                        onChange={(e) => handleAppearanceChange(appIdx, 'exam_year', e.target.value)}
                                                        className="w-20 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:ring-2 focus:ring-blue-500"
                                                        placeholder="Year"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={app.school_name || ''}
                                                        onChange={(e) => handleAppearanceChange(appIdx, 'school_name', e.target.value)}
                                                        className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-xs focus:ring-2 focus:ring-blue-500"
                                                        placeholder="School (optional)"
                                                    />
                                                    <button
                                                        onClick={() => removeAppearance(appIdx)}
                                                        className="text-red-400 hover:text-red-300 px-1.5 py-1 text-xs rounded hover:bg-red-900/20 transition-colors"
                                                        title="Remove this appearance"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Continues on next page */}
                                    <div className="flex flex-col gap-2 pt-2">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id={`continues-${index}`}
                                                checked={localQuestion.continues_on_next_page || false}
                                                onChange={(e) => handleChange('continues_on_next_page', e.target.checked)}
                                                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-2 focus:ring-yellow-500"
                                            />
                                            <label htmlFor={`continues-${index}`} className="text-sm text-yellow-400 flex items-center gap-1">
                                                ➡️ Continues on next page
                                            </label>
                                        </div>
                                        {localQuestion.is_continuation && (
                                            <div className="text-sm text-blue-400 flex items-center gap-1 bg-blue-900/20 py-1 border-l-2 border-blue-500 px-2">
                                                ⬅️ This question is a continuation from the previous page
                                                {localQuestion.continuation_of && ` (Continuing: ${localQuestion.continuation_of.replace('_', ' ')})`}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {previewImage && (
                <ImageModal
                    src={previewImage}
                    onClose={() => setPreviewImage(null)}
                />
            )}
        </>
    );
}
