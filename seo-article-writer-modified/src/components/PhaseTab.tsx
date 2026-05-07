import { useState } from 'react';
import { useStore } from '../store';
import { callLLM, PROVIDERS } from '../api';
import {
  PHASE_1_SYSTEM,
  PHASE_2_SYSTEM,
  PHASE_3_SYSTEM,
  FACTUAL_PASS_SYSTEM,
  buildPhase1UserMessage,
  buildPhase2UserMessage,
  buildPhase3UserMessage,
  buildFactualPassUserMessage,
  buildRevisionUserMessage
} from '../prompts';
import { parseScores } from '../utils/parseScores';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorBanner } from './ErrorBanner';
import toast from 'react-hot-toast';

interface Props {
  phase: 1 | 2 | 3;
  articleIndex: number;
}

export function PhaseTab({ phase, articleIndex }: Props) {
  const provider = useStore((s) => s.provider);
  const apiKey = useStore((s) => s.apiKeys[s.provider]);
  const providerLabel = PROVIDERS[provider].label;
  const article = useStore((s) => s.articles[articleIndex]);
  const setPhaseOutput = useStore((s) => s.setPhaseOutput);
  const setPhase2Scores = useStore((s) => s.setPhase2Scores);
  const setPhase2ManualOverride = useStore((s) => s.setPhase2ManualOverride);
  const approvePhase = useStore((s) => s.approvePhase);
  const setFactualPassOutput = useStore((s) => s.setFactualPassOutput);
  const markComplete = useStore((s) => s.markComplete);

  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const currentOutput =
    phase === 1 ? article.phase1Output : phase === 2 ? article.phase2Output : article.phase3Output;

  const runPhase = async (isRevision = false) => {
    setError(null);
    setLoading(true);

    try {
      let systemPrompt = '';
      let userMessage = '';
      let label = '';

      if (phase === 1) {
        systemPrompt = PHASE_1_SYSTEM;
        userMessage = buildPhase1UserMessage(article.keyword, article.competitorReport);
        label = `${providerLabel} is analyzing competitors...`;
      } else if (phase === 2) {
        if (!article.phase1Output) throw new Error('Phase 1 output missing');
        systemPrompt = PHASE_2_SYSTEM;
        if (isRevision && article.phase2Output) {
          const failedScore: 'outlineQuality' | 'seoPotential' =
            article.phase2OutlineScore !== null && article.phase2OutlineScore < 90
              ? 'outlineQuality'
              : 'seoPotential';
          userMessage = buildRevisionUserMessage(article.phase2Output, failedScore);
          label = `${providerLabel} is revising the outline...`;
        } else {
          userMessage = buildPhase2UserMessage(article.keyword, article.phase1Output);
          label = `${providerLabel} is building the outline...`;
        }
      } else {
        if (!article.phase2Output) throw new Error('Phase 2 output missing');
        systemPrompt = PHASE_3_SYSTEM;
        userMessage = buildPhase3UserMessage(article.keyword, article.phase2Output);
        label = `${providerLabel} is writing the article...`;
      }

      setLoadingLabel(label);
      const output = await callLLM(provider, apiKey, systemPrompt, userMessage);
      setPhaseOutput(articleIndex, phase, output);

      if (phase === 2) {
        const scores = parseScores(output);
        setPhase2Scores(articleIndex, scores.outlineQuality, scores.seoPotential);
        if (scores.outlineQuality === null || scores.seoPotential === null) {
          toast('Could not auto-parse scores. Verify manually.', { icon: '⚠️' });
        }
      }
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
      setLoadingLabel('');
    }
  };

  const runFactualPass = async () => {
    if (!article.phase3Output) return;
    setError(null);
    setLoading(true);
    setLoadingLabel('Running factual integrity pass...');
    try {
      const output = await callLLM(
        provider,
        apiKey,
        FACTUAL_PASS_SYSTEM,
        buildFactualPassUserMessage(article.phase3Output)
      );
      setFactualPassOutput(articleIndex, output);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
      setLoadingLabel('');
    }
  };

  const handleApprove = () => {
    if (phase === 1) {
      approvePhase(articleIndex, 1);
      toast.success('Phase 1 approved. Move to Phase 2.');
    } else if (phase === 2) {
      const outline = article.phase2OutlineScore;
      const seo = article.phase2SeoScore;
      const passed = article.phase2ManualOverride ||
        ((outline !== null && outline >= 90) && (seo !== null && seo >= 90));
      if (!passed) {
        toast.error('Both scores must be 90+ (or manual override checked).');
        return;
      }
      approvePhase(articleIndex, 2);
      toast.success('Phase 2 approved. Move to Phase 3.');
    }
  };

  const handleComplete = () => {
    markComplete(articleIndex);
    toast.success(`Article ${articleIndex + 1} complete!`);
  };

  const handleRerun = () => {
    if (currentOutput && !confirm('Re-run will overwrite existing output. Continue?')) return;
    runPhase(false);
  };

  const outlineScore = article.phase2OutlineScore;
  const seoScore = article.phase2SeoScore;
  const scoresPassed =
    (outlineScore !== null && outlineScore >= 90 && outlineScore <= 100) &&
    (seoScore !== null && seoScore >= 90 && seoScore <= 100);
  const needsRevision =
    (outlineScore !== null && outlineScore < 90) ||
    (seoScore !== null && seoScore < 90);

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4">
          <ErrorBanner
            message={error}
            onRetry={() => runPhase(false)}
            onDismiss={() => setError(null)}
          />
        </div>
      )}

      {phase === 2 && currentOutput && (
        <div className="mb-4 flex gap-3">
          <ScoreChip label="Outline Quality" score={outlineScore} />
          <ScoreChip label="SEO Potential" score={seoScore} />
        </div>
      )}

      {!currentOutput && !loading && (
        <button
          onClick={() => runPhase(false)}
          disabled={loading || !apiKey}
          className="px-5 py-2.5 rounded-md bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:bg-gray-300"
        >
          {!apiKey ? 'API key required' : `Run Phase ${phase}`}
        </button>
      )}

      {loading && <LoadingSpinner label={loadingLabel} />}

      {currentOutput && !loading && (
        <>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Phase {phase} Output</h3>
            <button
              onClick={handleRerun}
              className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
            >
              Re-run
            </button>
          </div>
          <textarea
            value={currentOutput}
            onChange={(e) => setPhaseOutput(articleIndex, phase, e.target.value)}
            rows={20}
            className="w-full font-mono text-xs border border-gray-300 rounded-md p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />

          {phase === 2 && needsRevision && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800 mb-2">
                One or both scores are below 90. Revise before proceeding.
              </p>
              <button
                onClick={() => runPhase(true)}
                className="px-3 py-1.5 rounded bg-yellow-600 text-white text-xs hover:bg-yellow-700"
              >
                Revise Outline
              </button>
            </div>
          )}

          {phase === 2 && (outlineScore === null || seoScore === null) && (
            <label className="flex items-center gap-2 mt-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={article.phase2ManualOverride}
                onChange={(e) => setPhase2ManualOverride(articleIndex, e.target.checked)}
              />
              I've verified scores manually (both are 90+)
            </label>
          )}

          {phase === 3 && (
            <div className="mt-4">
              <button
                onClick={runFactualPass}
                disabled={loading}
                className="px-4 py-2 rounded-md border border-blue-300 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100"
              >
                Run Factual Integrity Pass
              </button>
              {article.phase3FactualPassOutput && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    Revised Article (after factual pass)
                  </h4>
                  <textarea
                    value={article.phase3FactualPassOutput}
                    onChange={(e) => setFactualPassOutput(articleIndex, e.target.value)}
                    rows={20}
                    className="w-full font-mono text-xs border border-gray-300 rounded-md p-3"
                  />
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            {phase < 3 ? (
              <button
                onClick={handleApprove}
                disabled={phase === 2 && !scoresPassed && !article.phase2ManualOverride}
                className="px-5 py-2.5 rounded-md bg-green-600 text-white font-medium text-sm hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Approve & Continue to Phase {phase + 1} →
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="px-5 py-2.5 rounded-md bg-green-600 text-white font-medium text-sm hover:bg-green-700"
              >
                Mark Article Complete ✓
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ScoreChip({ label, score }: { label: string; score: number | null }) {
  if (score === null) {
    return (
      <div className="px-3 py-2 rounded-md bg-gray-100 text-gray-600 text-sm">
        <span className="font-medium">{label}:</span> not parsed
      </div>
    );
  }
  const good = score >= 90 && score <= 95;
  const cls = good ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
  return (
    <div className={`px-3 py-2 rounded-md text-sm ${cls}`}>
      <span className="font-medium">{label}:</span> {score}/100
    </div>
  );
}
