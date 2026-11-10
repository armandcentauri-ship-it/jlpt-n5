/* SRS SM-2 (type Anki) — utilisé côté serveur pour /api/review,
   et côté client pour l'aperçu des intervalles. */

import type { Grade } from "./types";

export interface SrsState {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: Date;
  lastReviewedAt: Date;
}

const DAY = 1;
const MIN = 10 / 1440; // 10 minutes

/** Applique l'algorithme SM-2 adapté (grades Anki : encore/hard/good/easy).
 *  mode "conj" (conjugaison) : 2 bonnes réponses suffisent pour maîtriser une forme. */
export function applySm2(
  prev: { ease: number; intervalDays: number; reps: number; lapses: number } | null | undefined,
  grade: Grade,
  now: Date = new Date(),
  mode?: string
): SrsState {
  const ease = prev?.ease ?? 2.5;
  const interval = prev?.intervalDays ?? 0;
  const reps = prev?.reps ?? 0;
  const lapses = prev?.lapses ?? 0;

  let newEase = ease;
  let newInterval: number;
  let newReps = reps;
  let newLapses = lapses;

  switch (grade) {
    case 0: // Encore : réapprentissage aujourd'hui
      newEase = Math.max(1.3, ease - 0.2);
      newInterval = MIN;
      newReps = 0;
      newLapses = lapses + 1;
      break;
    case 1: // Difficile
      newEase = Math.max(1.3, ease - 0.15);
      newInterval = reps === 0 ? 0.5 : Math.max(interval * 1.2, interval + 0.5);
      newReps = reps + 1;
      break;
    case 2: // Bien
      if (mode === "conj") {
        // conjugaison : 1ʳᵉ bonne réponse → révision demain, 2ᵉ → maîtrisé (21 j)
        newInterval = reps === 0 ? DAY : Math.max(interval * ease, 21 * DAY);
      } else {
        newInterval = reps === 0 ? DAY : reps === 1 ? 3 * DAY : interval * ease;
      }
      newReps = reps + 1;
      break;
    case 3: // Facile
      newInterval = reps === 0 ? 3 * DAY : reps === 1 ? 6 * DAY : interval * ease * 1.3;
      newReps = reps + 1;
      break;
  }

  newInterval = Math.min(newInterval, 365);

  return {
    ease: newEase,
    intervalDays: newInterval,
    reps: newReps,
    lapses: newLapses,
    dueAt: new Date(now.getTime() + newInterval * 24 * 3600 * 1000),
    lastReviewedAt: now,
  };
}

/** Étiquette lisible d'un intervalle en jours (ex. "10 min", "3 j", "1,2 mois"). */
export function formatInterval(days: number): string {
  if (days < 1 / 24) return `${Math.max(1, Math.round(days * 24 * 60))} min`;
  if (days < 1) return `${Math.round(days * 24)} h`;
  if (days < 30) return `${Math.round(days)} j`;
  if (days < 365) return `${(days / 30).toFixed(days / 30 < 10 ? 1 : 0).replace(".", ",")} mois`;
  return `${(days / 365).toFixed(1).replace(".", ",")} an(s)`;
}

/** Différence relative avec maintenant, pour "à réviser dans X". */
export function dueLabel(dueAt: string | Date): string {
  const d = new Date(dueAt).getTime();
  const diffMin = Math.round((d - Date.now()) / 60000);
  if (diffMin <= 0) return "maintenant";
  if (diffMin < 60) return `dans ${diffMin} min`;
  if (diffMin < 24 * 60) return `dans ${Math.round(diffMin / 60)} h`;
  return `dans ${Math.round(diffMin / (24 * 60))} j`;
}
