'use client';

/**
 * QuestionForm Component
 * Editable form for question data with dynamic fields based on type
 */
import { useState, useEffect } from 'react';
import { Question, QuestionType, BOARDS } from '@/lib/types';

interface QuestionFormProps {
    question: Question;
    index: number;
    onChange: (index: number, question: Question) => void;
    onDelete: (index: number) => void;
}

export default function QuestionForm({ question, index, onChange, onDelete }: QuestionFormProps) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [localQuestion, setLocalQuestion] = useState<Question>(question);

    useEffect(() => {
        setLocalQuestion(question);
    }, [question]);

    const handleChange = (field: string, value: unknown) => {
        const updated = { ...localQuestion, [field]: value };
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

    return (
        <div className="border border-gray-700 rounded-lg bg-gray-800/50 overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 bg-gray-800 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-blue-400 bg-blue-900/30 px-2 py-1 rounded">
                        Q{index + 1}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${localQuestion.type === 'mcq' ? 'bg-green-900/30 text-green-400' :
                            localQuestion.type === 'short' ? 'bg-yellow-900/30 text-yellow-400' :
                                'bg-purple-900/30 text-purple-400'
                        }`}>
                        {localQuestion.type.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-300 truncate max-w-[300px]">
                        {localQuestion.question_text?.substring(0, 50)}...
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(index); }}
                        className="text-red-400 hover:text-red-300 text-sm px-2 py-1"
                    >
                        Delete
                    </button>
                    <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                </div>
            </div>

            {/* Form Fields */}
            {isExpanded && (
                <div className="p-4 space-y-4">
                    {/* Question Type */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Type</label>
                            <select
                                value={localQuestion.type}
                                onChange={(e) => handleChange('type', e.target.value as QuestionType)}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                            >
                                <option value="mcq">MCQ</option>
                                <option value="short">Short Question</option>
                                <option value="creative">Creative Question (CQ)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Has Image</label>
                            <select
                                value={localQuestion.has_image ? 'true' : 'false'}
                                onChange={(e) => handleChange('has_image', e.target.value === 'true')}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                            >
                                <option value="false">No</option>
                                <option value="true">Yes</option>
                            </select>
                        </div>
                    </div>

                    {/* Question Text */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Question Text</label>
                        <textarea
                            value={localQuestion.question_text || ''}
                            onChange={(e) => handleChange('question_text', e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm resize-none"
                        />
                    </div>

                    {/* Image Description (if has_image) */}
                    {localQuestion.has_image && (
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Image Description</label>
                            <textarea
                                value={localQuestion.image_description || ''}
                                onChange={(e) => handleChange('image_description', e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm resize-none"
                                placeholder="Describe the diagram or image..."
                            />
                        </div>
                    )}

                    {/* MCQ Options */}
                    {localQuestion.type === 'mcq' && (
                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-gray-400">Options</label>
                            {['ka', 'kha', 'ga', 'gha'].map((key) => (
                                <div key={key} className="flex items-center gap-2">
                                    <span className="w-10 text-sm text-gray-400 font-medium">{key}:</span>
                                    <input
                                        type="text"
                                        value={(localQuestion.options as Record<string, string>)?.[key] || ''}
                                        onChange={(e) => handleOptionsChange(key, e.target.value)}
                                        className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                                    />
                                </div>
                            ))}
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-gray-400">Correct Answer:</span>
                                <select
                                    value={localQuestion.correct_answer || ''}
                                    onChange={(e) => handleChange('correct_answer', e.target.value)}
                                    className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                                >
                                    <option value="">Select...</option>
                                    <option value="ka">ka</option>
                                    <option value="kha">kha</option>
                                    <option value="ga">ga</option>
                                    <option value="gha">gha</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Short Question Answer */}
                    {localQuestion.type === 'short' && (
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Answer</label>
                            <textarea
                                value={localQuestion.answer || ''}
                                onChange={(e) => handleChange('answer', e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm resize-none"
                                placeholder="Enter the answer if visible..."
                            />
                        </div>
                    )}

                    {/* Creative Question Sub-questions */}
                    {localQuestion.type === 'creative' && (
                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-gray-400">Sub-questions</label>
                            {['ka', 'kha', 'ga', 'gha'].map((key, i) => (
                                <div key={key} className="border border-gray-600 rounded p-2">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm font-medium text-blue-400">{key}:</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={localQuestion.sub_questions?.[i]?.text || ''}
                                        onChange={(e) => handleSubQuestionChange(i, 'text', e.target.value)}
                                        placeholder="Sub-question text..."
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm mb-2"
                                    />
                                    <textarea
                                        value={localQuestion.sub_questions?.[i]?.answer || ''}
                                        onChange={(e) => handleSubQuestionChange(i, 'answer', e.target.value)}
                                        placeholder="Answer (if visible)..."
                                        rows={2}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm resize-none"
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Metadata */}
                    <div className="border-t border-gray-700 pt-4">
                        <label className="block text-xs font-medium text-gray-400 mb-2">Metadata</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Board</label>
                                <input
                                    type="text"
                                    list="boards"
                                    value={localQuestion.metadata?.board || ''}
                                    onChange={(e) => handleMetadataChange('board', e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                                    placeholder="Dhaka Board..."
                                />
                                <datalist id="boards">
                                    {BOARDS.map((b) => <option key={b} value={b} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Year</label>
                                <input
                                    type="text"
                                    value={localQuestion.metadata?.exam_year || ''}
                                    onChange={(e) => handleMetadataChange('exam_year', e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                                    placeholder="2023"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">School</label>
                                <input
                                    type="text"
                                    value={localQuestion.metadata?.school_name || ''}
                                    onChange={(e) => handleMetadataChange('school_name', e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                                    placeholder="School name..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Q. Number</label>
                                <input
                                    type="text"
                                    value={localQuestion.metadata?.question_number || ''}
                                    onChange={(e) => handleMetadataChange('question_number', e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                                    placeholder="1, 2, 3..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Hints */}
                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Hints (comma-separated)</label>
                        <input
                            type="text"
                            value={localQuestion.hints?.join(', ') || ''}
                            onChange={(e) => handleChange('hints', e.target.value.split(',').map(h => h.trim()).filter(Boolean))}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                            placeholder="Hint 1, Hint 2..."
                        />
                    </div>

                    {/* Continues on next page */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id={`continues-${index}`}
                            checked={localQuestion.continues_on_next_page || false}
                            onChange={(e) => handleChange('continues_on_next_page', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500"
                        />
                        <label htmlFor={`continues-${index}`} className="text-sm text-yellow-400">
                            ⚠️ Continues on next page
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
}
