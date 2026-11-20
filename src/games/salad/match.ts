import type { Secret } from './words';

export function normalise(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').trim()
    .replace(/^(?:the|a|an)\s+/, '').replace(/\s/g, '');
}

// Count an adjacent transposition as a single typo.
function distance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  rows[0] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

export function matches(guess: string, secret: Secret): boolean {
  const attempt = normalise(guess);
  return !!attempt && [secret.answer, ...secret.also].some((label) => {
    const answer = normalise(label);
    const tolerance = (answer.match(/\p{L}/gu)?.length ?? 0) > 10 ? 2 : 1;
    return Math.abs(answer.length - attempt.length) <= tolerance && distance(answer, attempt) <= tolerance;
  });
}
