import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../store';
import { consolidateArticles, downloadMarkdown } from '../utils/consolidate';
import toast from 'react-hot-toast';

export function ConsolidationScreen() {
  const articles = useStore((s) => s.articles);
  const navigate = useStore((s) => s.navigate);
  const [showPreview, setShowPreview] = useState(true);

  const consolidated = useMemo(() => consolidateArticles(articles), [articles]);

  const handleDownload = () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    downloadMarkdown(consolidated, `seo-articles-batch-${timestamp}.md`);
    toast.success('Downloaded!');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(consolidated);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Copy failed. Use the download button instead.');
    }
  };

  const completedCount = articles.filter((a) => a.status === 'complete').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate('workspace')}
              className="text-sm text-gray-600 hover:text-gray-900 mb-2"
            >
              ← Back to workspace
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Consolidated Output</h1>
            <p className="text-sm text-gray-600 mt-1">
              {completedCount} article{completedCount !== 1 ? 's' : ''} combined into one markdown document
            </p>
          </div>
        </header>

        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="flex gap-3 mb-4">
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              Download as .md
            </button>
            <button
              onClick={handleCopy}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium hover:bg-gray-50"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="ml-auto px-4 py-2 rounded-md border border-gray-300 text-sm font-medium hover:bg-gray-50"
            >
              {showPreview ? 'Show Raw Markdown' : 'Show Rendered Preview'}
            </button>
          </div>

          {showPreview ? (
            <div className="prose prose-sm max-w-none border border-gray-200 rounded-md p-6 bg-white max-h-[70vh] overflow-y-auto">
              <ReactMarkdown>{consolidated}</ReactMarkdown>
            </div>
          ) : (
            <textarea
              value={consolidated}
              readOnly
              rows={30}
              className="w-full font-mono text-xs border border-gray-300 rounded-md p-3 bg-gray-50"
            />
          )}
        </div>
      </div>
    </div>
  );
}
