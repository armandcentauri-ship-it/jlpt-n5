/* Notation des réponses d'exercices : normalisation + distance tolérante,
   avec auto-correction possible (l'utilisateur garde le dernier mot). */

import { katakanaToHiragana } from "./romaji";

const JP_NOISE = /[。、！？!?.,，「」『』…・〜~-‐–\s\u3000]/g;

/** Normalise une réponse japonaise : NFKC, ponctuation/espaces retirés, katakana→hiragana. */
export function normalizeJp(s: string): string {
  return katakanaToHiragana(s.normalize("NFKC"))
    .replace(JP_NOISE, "")
    .toLowerCase();
}

/** Normalise une réponse française : minuscules, sans accents ni ponctuation. */
export function normalizeFr(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9àâçéèêëîïôûùüÿñæœ\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** 1 = identique, 0 = sans rapport. */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const d = levenshtein(a, b);
  return 1 - d / Math.max(a.length, b.length);
}

export type CheckResult = "correct" | "close" | "wrong";

/**
 * Vérifie la réponse de l'utilisateur contre les références acceptées.
 * direction "fr" : réponse attendue en français ; "jp" : en japonais.
 */
export function checkAnswer(
  input: string,
  refs: string[],
  direction: "fr" | "jp"
): { result: CheckResult; best: string; ratio: number } {
  const norm = direction === "fr" ? normalizeFr : normalizeJp;
  const user = norm(input);
  let best = "";
  let bestRatio = 0;
  for (const ref of refs) {
    if (!ref) continue;
    const r = norm(ref);
    if (!r) continue;
    // réponse contenue (ou contenant) presque complète
    const ratio = r.includes(user) && user.length >= r.length * 0.75 ? 1 : similarity(user, r);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = ref;
    }
  }
  const threshold = direction === "jp" ? 0.85 : 0.82;
  const result: CheckResult =
    bestRatio >= threshold ? "correct" : bestRatio >= threshold - 0.13 ? "close" : "wrong";
  return { result, best, ratio: bestRatio };
}
