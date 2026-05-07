import { useState } from 'react';
import { useStore } from '../store';
import { Sidebar } from './Sidebar';
import { PhaseTab } from './PhaseTab';

export function ArticleWorkspace() {
  const articles = useStore((s) => s.articles);
  const activeArticleIndex = useStore((s) => s.activeArticleIndex);
  const [activePhase, setActivePhase] = useState<1 | 2 | 3>(1);

  if (activeArticleIndex === null || !articles[activeArticleIndex]) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Select an article from the sidebar.
        </div>
      </div>
    );
  }

  const article = articles[activeArticleIndex];
  const phase1Done = article.phase1ApprovedAt !== null;
  const phase2Done = article.phase2ApprovedAt !== null;

  const tabDisabled = (phase: number) => {
    if (phase === 2 && !phase1Done) return true;
    if (phase === 3 && !phase2Done) return true;
    return false;
  };

  const handleTabClick = (phase: 1 | 2 | 3) => {
    if (tabDisabled(phase)) return;
    setActivePhase(phase);
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Article {article.index}: <span className="text-blue-700">{article.keyword}</span>
          </h1>
          <p className="text-xs text-gray-500 mb-6">Status: {article.status}</p>

          <div className="border-b border-gray-200 mb-0">
            <nav className="flex gap-8">
              {[1, 2, 3].map((p) => {
                const disabled = tabDisabled(p);
                const active = activePhase === p;
                const done =
                  (p === 1 && phase1Done) ||
                  (p === 2 && phase2Done) ||
                  (p === 3 && article.status === 'complete');
                return (
                  <button
                    key={p}
                    onClick={() => handleTabClick(p as 1 | 2 | 3)}
                    disabled={disabled}
                    className={`pb-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                      active
                        ? 'border-blue-600 text-blue-700'
                        : disabled
                        ? 'border-transparent text-gray-300 cursor-not-allowed'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Phase {p} {done && <span className="text-green-600">✓</span>}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="bg-white border border-t-0 border-gray-200 rounded-b-md">
            <PhaseTab phase={activePhase} articleIndex={activeArticleIndex} />
          </div>
        </div>
      </main>
    </div>
  );
}
