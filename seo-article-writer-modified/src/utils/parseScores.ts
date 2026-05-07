export interface ParsedScores {
  outlineQuality: number | null;
  seoPotential: number | null;
}

export function parseScores(text: string): ParsedScores {
  let outlineQuality: number | null = null;
  let seoPotential: number | null = null;

  // Split text into two halves at "SCORE 2" marker if present
  const score2Marker = /SCORE\s*2/i;
  const split = text.split(score2Marker);
  const firstHalf = split[0] || '';
  const secondHalf = split.length > 1 ? 'SCORE 2' + split.slice(1).join('SCORE 2') : '';

  outlineQuality = findTotalScore(firstHalf);
  seoPotential = findTotalScore(secondHalf);

  return { outlineQuality, seoPotential };
}

function findTotalScore(section: string): number | null {
  if (!section) return null;

  // Try specific patterns in order
  const patterns = [
    /Total[:\s]*(\d{1,3})\s*\/\s*100/i,
    /Total[:\s]*\*\*\s*(\d{1,3})\s*\/\s*100/i,
    /=\s*(\d{1,3})\s*\/\s*100/i,
    /(\d{1,3})\s*\/\s*100\s*$/im
  ];

  for (const pattern of patterns) {
    const match = section.match(pattern);
    if (match) {
      const score = parseInt(match[1], 10);
      if (score >= 0 && score <= 100) return score;
    }
  }
  return null;
}
