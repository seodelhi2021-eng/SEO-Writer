import { useStore } from '../store';
import toast from 'react-hot-toast';

const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  phase1: 'bg-blue-100 text-blue-700',
  phase2: 'bg-blue-100 text-blue-700',
  phase3: 'bg-blue-100 text-blue-700',
  complete: 'bg-green-100 text-green-700'
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  phase1: 'Phase 1',
  phase2: 'Phase 2',
  phase3: 'Phase 3',
  complete: 'Complete'
};

export function Sidebar() {
  const articles = useStore((s) => s.articles);
  const activeArticleIndex = useStore((s) => s.activeArticleIndex);
  const setActiveArticle = useStore((s) => s.setActiveArticle);
  const navigate = useStore((s) => s.navigate);
  const resetBatch = useStore((s) => s.resetBatch);

  const allComplete = articles.length > 0 && articles.every((a) => a.status === 'complete');

  const handleSelectArticle = (idx: number) => {
    const earliestIncomplete = articles.findIndex((a) => a.status !== 'complete');
    if (idx > earliestIncomplete && earliestIncomplete !== -1) {
      toast.error(`Complete Article ${earliestIncomplete + 1} first`);
      return;
    }
    setActiveArticle(idx);
  };

  const handleReset = () => {
    if (confirm('Reset batch? This will delete all articles, outputs, and progress. This cannot be undone.')) {
      resetBatch();
    }
  };

  return (
    <aside className="w-[280px] shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen">
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={handleReset}
          className="text-xs text-gray-600 hover:text-red-600"
        >
          ← Back to Setup
        </button>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">Articles</h2>
        <div className="space-y-2">
          {articles.map((article, i) => (
            <button
              key={i}
              onClick={() => handleSelectArticle(i)}
              className={`w-full text-left p-3 rounded-md border transition-colors ${
                activeArticleIndex === i
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900">Article {article.index}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${statusColors[article.status]}`}>
                  {statusLabels[article.status]}
                </span>
              </div>
              <div className="text-xs text-gray-600 truncate">{article.keyword}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={() => navigate('consolidation')}
          disabled={!allComplete}
          className="w-full px-3 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Final Consolidation
        </button>
        {!allComplete && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Complete all articles to enable
          </p>
        )}
      </div>
    </aside>
  );
}
