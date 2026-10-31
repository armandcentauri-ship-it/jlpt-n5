"use client";

import React, { createContext, useCallback, useContext } from "react";
import type { ContentResponse, ProgressItem, WordItem, KanjiItem } from "@/lib/types";

export interface AppState {
  words: WordItem[];
  kanji: KanjiItem[];
  progressMap: Map<string, ProgressItem>; // clé `${itemType}:${itemId}`
  stats: ContentResponse["stats"];
  applyProgress: (p: ProgressItem) => void;
  bumpStats: (grade: number, mode: string) => void;
}

export const progressKey = (itemType: string, itemId: string) => `${itemType}:${itemId}`;

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ value, children }: { value: AppState; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState doit être utilisé dans AppStateProvider");
  return v;
}

/** Construit la progression localisée depuis la réponse API. */
export function buildProgressMap(list: ProgressItem[]): Map<string, ProgressItem> {
  const m = new Map<string, ProgressItem>();
  for (const p of list) m.set(progressKey(p.itemType, p.itemId), p);
  return m;
}

/** Hook utilitaire : POST révision + mise à jour locale. */
export function useReview() {
  const { applyProgress, bumpStats } = useAppState();
  const [pending, setPending] = React.useState(false);

  const submit = useCallback(
    async (itemType: "kanji" | "word", itemId: string, grade: number, mode: string) => {
      bumpStats(grade, mode);
      try {
        setPending(true);
        const res = await fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemType, itemId, grade, mode }),
        });
        if (res.ok) {
          const json = (await res.json()) as { progress?: ProgressItem };
          if (json.progress) applyProgress(json.progress);
        }
      } catch {
        // hors-ligne : la progression locale est déjà à jour côté UI
      } finally {
        setPending(false);
      }
    },
    [applyProgress, bumpStats]
  );

  return { submit, pending };
}
