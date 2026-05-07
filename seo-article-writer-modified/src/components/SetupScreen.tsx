import { useState } from 'react';
import { useStore } from '../store';
import { PROVIDERS, type Provider } from '../api';
import toast from 'react-hot-toast';

interface ArticleInput {
  keyword: string;
  competitorReport: string;
}

export function SetupScreen() {
  const provider = useStore((s) => s.provider);
  const apiKeys = useStore((s) => s.apiKeys);
  const setProvider = useStore((s) => s.setProvider);
  const setApiKey = useStore((s) => s.setApiKey);
  const initBatch = useStore((s) => s.initBatch);

  const activeKey = apiKeys[provider];
  const activeConfig = PROVIDERS[provider];

  const [inputs, setInputs] = useState<ArticleInput[]>([
    { keyword: '', competitorReport: '' }
  ]);

  const updateInput = (i: number, field: keyof ArticleInput, value: string) => {
    setInputs((prev) => prev.map((x, idx) => (idx === i ? { ...x, [field]: value } : x)));
  };

  const addSlot = () => {
    if (inputs.length >= 5) return;
    setInputs((prev) => [...prev, { keyword: '', competitorReport: '' }]);
  };

  const removeSlot = (i: number) => {
    setInputs((prev) => prev.filter((_, idx) => idx !== i));
  };

  const canStart = () => {
    if (!activeKey.trim()) return false;
    const filled = inputs.filter((a) => a.keyword.trim() && a.competitorReport.trim());
    return filled.length >= 1;
  };

  const handleStart = () => {
    if (!activeKey.trim()) {
      toast.error(`${activeConfig.label} API key is required`);
      return;
    }
    const filled = inputs.filter((a) => a.keyword.trim() && a.competitorReport.trim());
    if (filled.length === 0) {
      toast.error('Add at least one article with keyword and competitor report');
      return;
    }
    initBatch(filled);
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">SEO Article Writer</h1>
        <p className="text-gray-600 mt-2">
          Batch up to 5 articles. Each runs Phase 1 (analysis), Phase 2 (outline with scoring gate), Phase 3 (article) as independent API calls — no conversation chaining.
        </p>
      </header>

      <section className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-700 block mb-2">LLM Provider</span>
          <div className="flex gap-2">
            {(Object.keys(PROVIDERS) as Provider[]).map((p) => {
              const cfg = PROVIDERS[p];
              const selected = provider === p;
              return (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`flex-1 px-4 py-3 rounded-md border text-sm font-medium transition ${
                    selected
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div>{cfg.label}</div>
                  <div className="text-xs font-normal text-gray-500 mt-0.5">{cfg.model}</div>
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">{activeConfig.label} API Key</span>
          <input
            type="password"
            value={activeKey}
            onChange={(e) => setApiKey(provider, e.target.value)}
            placeholder={activeConfig.keyPlaceholder}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
          <span className="text-xs text-gray-500 mt-1 block">{activeConfig.keyHint}</span>
        </label>
      </section>

      <section className="space-y-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Articles ({inputs.length}/5)</h2>
        {inputs.map((input, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">Article {i + 1}</h3>
              {inputs.length > 1 && (
                <button
                  onClick={() => removeSlot(i)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              )}
            </div>
            <label className="block mb-4">
              <span className="text-sm font-medium text-gray-700">Primary Keyword</span>
              <input
                type="text"
                value={input.keyword}
                onChange={(e) => updateInput(i, 'keyword', e.target.value)}
                placeholder="e.g. sitemap generator uploadarticle.com"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Competitor Report</span>
              <textarea
                value={input.competitorReport}
                onChange={(e) => updateInput(i, 'competitorReport', e.target.value)}
                placeholder="Paste competitor_report.md contents here..."
                rows={8}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </label>
          </div>
        ))}

        {inputs.length < 5 && (
          <button
            onClick={addSlot}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-800"
          >
            + Add another article
          </button>
        )}
      </section>

      <div className="flex justify-end">
        <button
          onClick={handleStart}
          disabled={!canStart()}
          className="px-6 py-2 rounded-md bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Start Batch →
        </button>
      </div>
    </div>
  );
}
