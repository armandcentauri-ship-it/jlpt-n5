"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppStateProvider, buildProgressMap, type AppState } from "@/components/jlpt/state";
import { TABS, type TabId } from "@/components/jlpt/tabs";
import { Dashboard } from "@/components/jlpt/Dashboard";
import { Flashcards } from "@/components/jlpt/Flashcards";
import { Exercises } from "@/components/jlpt/Exercises";
import { KanjiExplorer } from "@/components/jlpt/KanjiExplorer";
import { VocabExplorer } from "@/components/jlpt/VocabExplorer";
import { Conjugation } from "@/components/jlpt/Conjugation";
import type { ContentResponse, ProgressItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Home() {
  const [data, setData] = useState<ContentResponse | null>(null);
  const [progressMap, setProgressMap] = useState<Map<string, ProgressItem>>(new Map());
  const [stats, setStats] = useState<ContentResponse["stats"]>({
    attempts: 0,
    correct: 0,
    attemptsToday: 0,
    correctToday: 0,
    doneToday: { vocab: false, kanji: false, phrases: false, conj: false },
  });
  const [tab, setTab] = useState<TabId>("dashboard");
  const [launch, setLaunch] = useState<{ tab: TabId; nonce: number; cardType?: "word" | "kanji" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/content", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ContentResponse;
      setData(json);
      setProgressMap(buildProgressMap(json.progress));
      setStats(json.stats);
    } catch {
      setError("Impossible de charger les données. Réessaie en actualisant la page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applyProgress = useCallback((p: ProgressItem) => {
    setProgressMap((m) => {
      const n = new Map(m);
      n.set(`${p.itemType}:${p.itemId}`, p);
      return n;
    });
  }, []);

  const bumpStats = useCallback((grade: number, mode: string, itemType: string) => {
    // domaine du tableau de bord touché par cette révision
    const domain =
      mode === "conj" || itemType === "conj"
        ? "conj"
        : mode === "ex_jp_fr" || mode === "ex_fr_jp"
          ? "phrases"
          : itemType === "kanji"
            ? "kanji"
            : "vocab";
    setStats((s) => ({
      attempts: s.attempts + (mode === "flashcard" ? 0 : 1),
      correct: s.correct + (mode === "flashcard" || grade < 2 ? 0 : 1),
      attemptsToday: s.attemptsToday + (mode === "flashcard" ? 0 : 1),
      correctToday: s.correctToday + (mode === "flashcard" || grade < 2 ? 0 : 1),
      doneToday: { ...s.doneToday, [domain]: true },
    }));
  }, []);

  /** Navigation ; autoStart = lancer directement l'exercice avec ses réglages par défaut. */
  const go = useCallback(
    (t: TabId, autoStart?: boolean, cardType?: "word" | "kanji") => {
      if (autoStart) setLaunch({ tab: t, nonce: Date.now(), cardType });
      setTab(t);
    },
    []
  );

  const appState: AppState | null = useMemo(
    () =>
      data
        ? { words: data.words, kanji: data.kanji, progressMap, stats, applyProgress, bumpStats }
        : null,
    [data, progressMap, stats, applyProgress, bumpStats]
  );

  return (
    <div className="flex min-h-screen flex-col">
      {/* En-tête + navigation */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-jp text-lg font-bold text-primary-foreground"
              >
                日
              </span>
              <div>
                <p className="font-jp text-lg font-bold leading-tight">日本語 N5</p>
              </div>
            </div>
            <p className="hidden font-jp text-sm text-muted-foreground sm:block" aria-hidden>
              一期一会
            </p>
          </div>
          <nav aria-label="Navigation principale" className="custom-scroll -mx-1 overflow-x-auto px-1">
            <div className="flex gap-1 pb-0.5">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    tab === t.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {loading ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4" role="status">
            <span
              aria-hidden
              className="flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-primary/10 font-jp text-2xl text-primary"
            >
              日
            </span>
            <p className="text-sm text-muted-foreground">Chargement du vocabulaire…</p>
          </div>
        ) : error || !appState ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
            <p className="font-jp text-4xl text-primary" aria-hidden>
              残念
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={load}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <AppStateProvider value={appState}>
            {tab === "dashboard" && <Dashboard go={go} />}
            {tab === "flashcards" && (
              <Flashcards
                key={launch?.tab === "flashcards" ? `fc-${launch.nonce}` : "flashcards"}
                go={go}
                autoStart={launch?.tab === "flashcards"}
                initialType={launch?.cardType ?? "word"}
              />
            )}
            {tab === "exercises" && (
              <Exercises key={launch?.tab === "exercises" ? `ex-${launch.nonce}` : "exercises"} autoStart={launch?.tab === "exercises"} />
            )}
            {tab === "conjugation" && (
              <Conjugation key={launch?.tab === "conjugation" ? `cj-${launch.nonce}` : "conjugation"} autoStart={launch?.tab === "conjugation"} />
            )}
            {tab === "kanji" && <KanjiExplorer />}
            {tab === "vocab" && <VocabExplorer />}
          </AppStateProvider>
        )}
      </main>

      <footer className="mt-auto border-t border-border/80 bg-card/60">
        <div className="mx-auto w-full max-w-3xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[10px] leading-relaxed text-muted-foreground/80">
          <p>
            Sources :{" "}
            <a
              href="https://github.com/evanclan/OpenJLPT"
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-dotted hover:text-foreground"
            >
              OpenJLPT
            </a>{" "}
            (CC BY-SA) ·{" "}
            <a
              href="https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project"
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-dotted hover:text-foreground"
            >
              JMdict
            </a>{" "}
            /{" "}
            <a
              href="https://www.edrdg.org/wiki/index.php/KANJIDIC_Project"
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-dotted hover:text-foreground"
            >
              KANJIDIC2
            </a>{" "}
            (EDRDG) ·{" "}
            <a
              href="https://kanjikana.com/fr/kanji/jlpt/n4/pages/1"
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-dotted hover:text-foreground"
            >
              kanjikana.com
            </a>{" "}
            <span className="font-jp">· 頑張って !</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
