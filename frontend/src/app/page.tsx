'use client';

/**
 * Home Page - PDF Upload
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadPDF } from '@/lib/api';

interface ChapterInput {
  num: number;
  title: string;
  start: number;
  end: number;
}

export default function Home() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    class_name: '',
    author: 'NCTB',
  });

  const [chapters, setChapters] = useState<ChapterInput[]>([
    { num: 1, title: '', start: 1, end: 10 }
  ]);

  const [file, setFile] = useState<File | null>(null);

  const addChapter = () => {
    const lastChapter = chapters[chapters.length - 1];
    setChapters([...chapters, {
      num: lastChapter.num + 1,
      title: '',
      start: lastChapter.end + 1,
      end: lastChapter.end + 10
    }]);
  };

  const removeChapter = (index: number) => {
    if (chapters.length > 1) {
      setChapters(chapters.filter((_, i) => i !== index));
    }
  };

  const updateChapter = (index: number, field: keyof ChapterInput, value: string | number) => {
    const updated = [...chapters];
    updated[index] = { ...updated[index], [field]: value };
    setChapters(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a PDF file');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      const data = new FormData();
      data.append('file', file);
      data.append('title', formData.title);
      data.append('subject', formData.subject);
      data.append('class_name', formData.class_name);
      data.append('author', formData.author);
      data.append('chapters', JSON.stringify(chapters));

      const response = await uploadPDF(data);
      router.push(`/books/${response.data.book_id}`);
    } catch (err) {
      setError('Upload failed. Please try again.');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            📚 Smart Textbook Digitization
          </h1>
          <p className="text-gray-400 text-lg">
            Upload your PDF textbook to extract and verify questions using AI
          </p>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleSubmit} className="bg-gray-800/50 backdrop-blur rounded-2xl p-8 shadow-xl border border-gray-700">
          {/* Book Details */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Book Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Physics Class 9-10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Subject</label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Physics"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Class</label>
              <input
                type="text"
                value={formData.class_name}
                onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                required
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Class 9-10"
              />
            </div>
          </div>

          {/* Chapters */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium text-gray-300">Chapters</label>
              <button
                type="button"
                onClick={addChapter}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                + Add Chapter
              </button>
            </div>
            <div className="space-y-3">
              {chapters.map((ch, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-700/30 p-3 rounded-lg">
                  <span className="text-gray-400 text-sm w-16">Ch {ch.num}</span>
                  <input
                    type="text"
                    value={ch.title}
                    onChange={(e) => updateChapter(i, 'title', e.target.value)}
                    placeholder="Chapter Title"
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  />
                  <input
                    type="number"
                    value={ch.start}
                    onChange={(e) => updateChapter(i, 'start', parseInt(e.target.value))}
                    className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm text-center"
                    placeholder="Start"
                  />
                  <span className="text-gray-500">→</span>
                  <input
                    type="number"
                    value={ch.end}
                    onChange={(e) => updateChapter(i, 'end', parseInt(e.target.value))}
                    className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm text-center"
                    placeholder="End"
                  />
                  {chapters.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeChapter(i)}
                      className="text-red-400 hover:text-red-300 px-2"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* PDF Upload */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-2">PDF File</label>
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="pdf-upload"
              />
              <label htmlFor="pdf-upload" className="cursor-pointer">
                {file ? (
                  <div className="text-green-400">
                    <span className="text-2xl">✓</span>
                    <p className="mt-2">{file.name}</p>
                  </div>
                ) : (
                  <div className="text-gray-400">
                    <span className="text-4xl">📄</span>
                    <p className="mt-2">Click to select PDF file</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isUploading}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⟳</span> Uploading & Converting...
              </span>
            ) : (
              'Upload & Process PDF'
            )}
          </button>
        </form>

        {/* View Existing Books */}
        <div className="mt-8 text-center">
          <a href="/books" className="text-blue-400 hover:text-blue-300">
            View Existing Books →
          </a>
        </div>
      </div>
    </main>
  );
}
