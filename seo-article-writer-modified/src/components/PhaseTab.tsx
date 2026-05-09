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

const CHATGPT_SCORING_PROMPT = `You are an SEO content strategist evaluating a competitor article outline for its likelihood to rank in Google's top 3 for the target keyword. Be critical and honest. Do not inflate.

Score the outline below across six dimensions:

1. Search intent alignment — does it match what users actually search for? (/17)
2. Content structure & headings — are H2s/H3s well-organized and keyword-rich? (/17)
3. Topic coverage & depth — does it comprehensively cover the subject? (/17)
4. E-E-A-T signals — experience, expertise, authoritativeness, trustworthiness (/17)
5. Keyword optimization — natural use of primary and secondary keywords (/16)
6. Competitor edge — would it stand out against what's already ranking? (/16)

Provide a total out of 100.

Also state:
- The 3 weakest elements of this outline
- What's missing that top-ranking articles would include
- Whether you would approve this outline or request revision (threshold: 85/100)

PRIMARY KEYWORD: [paste keyword]

OUTLINE TO EVALUATE:
[paste Phase 2 output]`;

export function PhaseTab({ phase, articleIndex }: Props) {
  const provider = useStore((s) => s.provider);
  const apiKey = useStore((s) => s.apiKeys[s.provider]);
  const providerLabel = PROVIDERS[provider].label;
  const article = useStore((s) => s.articles[articleIndex]);
  const setPhaseOutput = useStore((s) => s.setPhaseOutput);
  const setPhase2Scores = useStore((s) => s.setPhase2Scores);
  const setPhase2ManualOverride = useStore((s) => s.setPhase2ManualOverride);
  const setPhase2ExternalFeedback = useStore((s) => s.setPhase2ExternalFeedback);
  const approvePhase = useStore((s) => s.approvePhase);
  const setFactualPassOutput = useStore((s) => s.setFactualPassOutput);
  const markComplete = useStore((s) => s.markComplete);

  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showScoringPrompt, setShowScoringPrompt] = useState(false);

  const currentOutput =
    phase === 1 ? article.phase1Output : phase === 2 ? article.phase2Output : article.phase3Output;

  const runPhase = async (revisionReason?: 'outlineQuality' | 'seoPotential' | 'external') => {
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
        if (revisionReason && article.phase2Output) {
          userMessage = buildRevisionUserMessage(
            article.phase2Output,
            revisionReason,
            revisionReason === 'external' ? article.phase2ExternalFeedback : undefined
          );
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
    runPhase();
  };

  const copyScoringPrompt = async () => {
    const filled = CHATGPT_SCORING_PROMPT
      .replace('[paste keyword]', article.keyword)
      .replace('[paste Phase 2 output]', article.phase2Output || '');
    try {
      await navigator.clipboard.writeText(filled);
      toast.success('Scoring prompt copied. Paste into ChatGPT or another AI.');
    } catch {
      toast.error('Copy failed. Select the text manually.');
    }
  };

  const copyOutlineOnly = async () => {
    if (!article.phase2Output) return;
    try {
      await navigator.clipboard.writeText(article.phase2Output);
      toast.success('Outline copied to clipboard.');
    } catch {
      toast.error('Copy failed.');
    }
  };

  const outlineScore = article.phase2OutlineScore;
  const seoScore = article.phase2SeoScore;
  const scoresPassed =
    (outlineScore !== null && outlineScore >= 90 && outlineScore <= 100) &&
    (seoScore !== null && seoScore >= 90 && seoScore <= 100);
  const needsRevision =
    (outlineScore !== null && outlineScore < 90) ||
    (seoScore !== null && seoScore < 90);

  const hasExternalFeedback = article.phase2ExternalFeedback.trim().length > 0;

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4">
          <ErrorBanner
            message={error}
            onRetry={() => runPhase()}
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
          onClick={() => runPhase()}
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

          {phase === 2 && (
            <div className="mt-5 border-t border-gray-200 pt-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-700">
                  External Feedback Cross-Check (optional)
                </h4>
                <button
                  onClick={() => setShowScoringPrompt(!showScoringPrompt)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  {showScoringPrompt ? 'Hide instructions' : 'How does this work?'}
                </button>
              </div>

              {showScoringPrompt && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-gray-700 space-y-2">
                  <p>
                    Cross-check this outline with a different AI (ChatGPT, Gemini, etc.)
                    to catch weaknesses {providerLabel} may have missed in its self-scoring.
                  </p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Click <strong>Copy Scoring Prompt</strong> below</li>
                    <li>Paste into ChatGPT (chat.openai.com) or Gemini</li>
                    <li>Copy the response back into the feedback textarea below</li>
                    <li>Click <strong>Revise with External Feedback</strong></li>
                    <li>{providerLabel} will revise the outline addressing the specific issues</li>
                  </ol>
                </div>
              )}

              <div className="flex gap-2 mb-3">
                <button
                  onClick={copyScoringPrompt}
                  className="text-xs px-3 py-1.5 rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                >
                  Copy Scoring Prompt (for ChatGPT/Gemini)
                </button>
                <button
                  onClick={copyOutlineOnly}
                  className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                >
                  Copy Outline Only
                </button>
              </div>

              <textarea
                value={article.phase2ExternalFeedback}
                onChange={(e) => setPhase2ExternalFeedback(articleIndex, e.target.value)}
                placeholder="Paste ChatGPT's / Gemini's scoring and feedback here. Then click Revise with External Feedback below."
                rows={8}
                className="w-full font-mono text-xs border border-gray-300 rounded-md p-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />

              {hasExternalFeedback && (
                <div className="mt-3">
                  <button
                    onClick={() => runPhase('external')}
                    disabled={loading}
                    className="px-4 py-2 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:bg-gray-300"
                  >
                    Revise with External Feedback
                  </button>
                  <p className="text-xs text-gray-500 mt-1">
                    {providerLabel} will rewrite the outline using the feedback above.
                  </p>
                </div>
              )}
            </div>
          )}

          {phase === 2 && needsRevision && !hasExternalFeedback && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800 mb-2">
                One or both scores are below 90. Revise before proceeding.
              </p>
              <button
                onClick={() => runPhase(
                  outlineScore !== null && outlineScore < 90 ? 'outlineQuality' : 'seoPotential'
                )}
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
