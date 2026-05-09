import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Provider } from './api';

export type ArticleStatus = 'pending' | 'phase1' | 'phase2' | 'phase3' | 'complete';

export interface Article {
  index: number;
  keyword: string;
  competitorReport: string;
  phase1Output: string | null;
  phase1ApprovedAt: number | null;
  phase2Output: string | null;
  phase2OutlineScore: number | null;
  phase2SeoScore: number | null;
  phase2ManualOverride: boolean;
  phase2ExternalFeedback: string;
  phase2ApprovedAt: number | null;
  phase3Output: string | null;
  phase3FactualPassOutput: string | null;
  completedAt: number | null;
  status: ArticleStatus;
}

export type Screen = 'setup' | 'workspace' | 'consolidation';

interface AppState {
  provider: Provider;
  // Keys are stored per-provider so users don't have to re-enter when switching.
  apiKeys: Record<Provider, string>;
  articles: Article[];
  activeArticleIndex: number | null;
  currentScreen: Screen;

  setProvider: (p: Provider) => void;
  setApiKey: (provider: Provider, key: string) => void;
  initBatch: (articles: Pick<Article, 'keyword' | 'competitorReport'>[]) => void;
  setPhaseOutput: (articleIdx: number, phase: 1 | 2 | 3, output: string) => void;
  setPhase2Scores: (articleIdx: number, outline: number | null, seo: number | null) => void;
  setPhase2ManualOverride: (articleIdx: number, value: boolean) => void;
  setPhase2ExternalFeedback: (articleIdx: number, feedback: string) => void;
  approvePhase: (articleIdx: number, phase: 1 | 2) => void;
  setFactualPassOutput: (articleIdx: number, output: string) => void;
  markComplete: (articleIdx: number) => void;
  setActiveArticle: (idx: number) => void;
  navigate: (screen: Screen) => void;
  resetBatch: () => void;
}

const emptyArticle = (index: number): Article => ({
  index,
  keyword: '',
  competitorReport: '',
  phase1Output: null,
  phase1ApprovedAt: null,
  phase2Output: null,
  phase2OutlineScore: null,
  phase2SeoScore: null,
  phase2ManualOverride: false,
  phase2ExternalFeedback: '',
  phase2ApprovedAt: null,
  phase3Output: null,
  phase3FactualPassOutput: null,
  completedAt: null,
  status: 'pending'
});

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      provider: 'anthropic',
      apiKeys: { anthropic: '', deepseek: '' },
      articles: [],
      activeArticleIndex: null,
      currentScreen: 'setup',

      setProvider: (p) => set({ provider: p }),

      setApiKey: (provider, key) =>
        set((state) => ({
          apiKeys: { ...state.apiKeys, [provider]: key }
        })),

      initBatch: (inputs) => {
        const articles = inputs.map((a, i) => ({
          ...emptyArticle(i + 1),
          keyword: a.keyword,
          competitorReport: a.competitorReport
        }));
        set({ articles, activeArticleIndex: 0, currentScreen: 'workspace' });
      },

      setPhaseOutput: (idx, phase, output) =>
        set((state) => ({
          articles: state.articles.map((a, i) => {
            if (i !== idx) return a;
            if (phase === 1) return { ...a, phase1Output: output, status: 'phase1' };
            if (phase === 2) return { ...a, phase2Output: output, status: 'phase2' };
            return { ...a, phase3Output: output, status: 'phase3' };
          })
        })),

      setPhase2Scores: (idx, outline, seo) =>
        set((state) => ({
          articles: state.articles.map((a, i) =>
            i === idx ? { ...a, phase2OutlineScore: outline, phase2SeoScore: seo } : a
          )
        })),

      setPhase2ManualOverride: (idx, value) =>
        set((state) => ({
          articles: state.articles.map((a, i) =>
            i === idx ? { ...a, phase2ManualOverride: value } : a
          )
        })),

      setPhase2ExternalFeedback: (idx, feedback) =>
        set((state) => ({
          articles: state.articles.map((a, i) =>
            i === idx ? { ...a, phase2ExternalFeedback: feedback } : a
          )
        })),

      approvePhase: (idx, phase) =>
        set((state) => ({
          articles: state.articles.map((a, i) => {
            if (i !== idx) return a;
            const now = Date.now();
            if (phase === 1) return { ...a, phase1ApprovedAt: now, status: 'phase2' };
            return { ...a, phase2ApprovedAt: now, status: 'phase3' };
          })
        })),

      setFactualPassOutput: (idx, output) =>
        set((state) => ({
          articles: state.articles.map((a, i) =>
            i === idx ? { ...a, phase3FactualPassOutput: output } : a
          )
        })),

      markComplete: (idx) =>
        set((state) => {
          const articles = state.articles.map((a, i) =>
            i === idx ? { ...a, completedAt: Date.now(), status: 'complete' as ArticleStatus } : a
          );
          const nextIdx = articles.findIndex((a) => a.status !== 'complete');
          return {
            articles,
            activeArticleIndex: nextIdx >= 0 ? nextIdx : idx
          };
        }),

      setActiveArticle: (idx) => set({ activeArticleIndex: idx }),

      navigate: (screen) => set({ currentScreen: screen }),

      resetBatch: () =>
        set({ articles: [], activeArticleIndex: null, currentScreen: 'setup' })
    }),
    {
      name: 'seo-article-writer',
      version: 3,
      // Migrate old persisted state into the current shape.
      // v1 -> v2: single `apiKey` -> per-provider `apiKeys`.
      // v2 -> v3: add `phase2ExternalFeedback` default to each article.
      migrate: (persistedState: any, fromVersion: number) => {
        let state = persistedState;
        if (fromVersion < 2 && state && typeof state === 'object') {
          const oldKey = typeof state.apiKey === 'string' ? state.apiKey : '';
          state = {
            ...state,
            provider: 'anthropic',
            apiKeys: { anthropic: oldKey, deepseek: '' },
            apiKey: undefined
          };
        }
        if (fromVersion < 3 && state && typeof state === 'object' && Array.isArray(state.articles)) {
          state = {
            ...state,
            articles: state.articles.map((a: any) => ({
              ...a,
              phase2ExternalFeedback:
                typeof a?.phase2ExternalFeedback === 'string' ? a.phase2ExternalFeedback : ''
            }))
          };
        }
        return state;
      }
    }
  )
);
