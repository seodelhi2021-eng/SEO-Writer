import type { Article } from '../store';

export function consolidateArticles(articles: Article[]): string {
  const completed = articles.filter((a) => a.status === 'complete');
  if (completed.length === 0) return '';

  // Table of contents
  const toc = ['# Consolidated Article Batch\n'];
  toc.push('## Contents\n');
  completed.forEach((a, i) => {
    toc.push(`${i + 1}. Article ${a.index}: ${a.keyword}`);
  });
  toc.push('\n---\n');

  // Each article
  const body = completed.map((a) => {
    const articleText = a.phase3FactualPassOutput || a.phase3Output || '';
    return articleText.trim();
  });

  return toc.join('\n') + '\n' + body.join('\n\n---\n\n');
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
