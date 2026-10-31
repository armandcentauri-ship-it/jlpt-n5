"use client";

import React, { useMemo } from "react";
import { BookOpenText, Layers, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAppState, progressKey } from "./state";
import { ProgressRing, StatCard } from "./bits";
import type { TabId } from "./tabs";

const MASTERED_DAYS = 21;

export function Dashboard({ go }: { go: (tab: TabId) => void }) {
  const { words, kanji, progressMap, stats } = useAppState();
  const { toast } = useToast();

  const s = useMemo(() => {
    let wordsStudied = 0,
      wordsMastered = 0,
      kanjiStudied = 0,
      kanjiMastered = 0,
      wordsDue = 0,
      kanjiDue = 0;
    const now = Date.now();
    for (const w of words) {
      const p = progressMap.get(progressKey("word", w.id));
      if (!p) continue;
      wordsStudied++;
      if (p.intervalDays >= MASTERED_DAYS) wordsMastered++;
      if (new Date(p.dueAt).getTime() <= now) wordsDue++;
    }
    for (const k of kanji) {
      const p = progressMap.get(progressKey("kanji", k.id));
      if (!p) continue;
      kanjiStudied++;
      if (p.intervalDays >= MASTERED_DAYS) kanjiMastered++;
      if (new Date(p.dueAt).getTime() <= now) kanjiDue++;
    }
    return { wordsStudied, wordsMastered, kanjiStudied, kanjiMastered, wordsDue, kanjiDue };
  }, [words, kanji, progressMap]);

  const accuracy = stats.attempts > 0 ? Math.round((stats.correct / stats.attempts) * 100) : null;
  const dueTotal = s.wordsDue + s.kanjiDue;

  const reset = async () => {
    try {
      await fetch("/api/reset", { method: "POST" });
      window.location.reload();
    } catch {
      toast({ title: "Erreur", description: "La réinitialisation a échoué.", variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-10 pt-6">
      {/* Hero */}
      <section className="anim-fade-up relative overflow-hidden rounded-2xl border bg-card px-6 py-8 text-center shadow-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-gold/10"
        />
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-md">
          <span className="font-jp-serif text-3xl font-bold text-primary-foreground">日</span>
        </div>
        <h1 className="relative mt-4 font-jp-serif text-2xl font-bold md:text-3xl">
          日本語を学ぼう <span className="text-primary">·</span> JLPT N5
        </h1>
        <p className="relative mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          251 kanji (N5 + N4), 1054 mots de vocabulaire organisés par thèmes, flashcards à répétition
          espacée et exercices de traduction dans les deux sens.
        </p>
        <div className="relative mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => go("flashcards")} className="h-11 rounded-full px-6 font-medium shadow-sm">
            <Layers className="mr-2 h-4 w-4" aria-hidden />
            Flashcards {dueTotal > 0 && <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 text-xs">{dueTotal}</span>}
          </Button>
          <Button
            onClick={() => go("exercises")}
            variant="outline"
            className="h-11 rounded-full border-primary/40 px-6 font-medium text-primary hover:bg-primary/10 hover:text-primary"
          >
            <BookOpenText className="mr-2 h-4 w-4" aria-hidden />
            Exercices de traduction
          </Button>
        </div>
      </section>

      {/* Progression */}
      <section className="anim-fade-up grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Progression">
        <StatCard title="Vocabulaire" className="text-center">
          <div className="mt-2 flex justify-center">
            <ProgressRing value={words.length ? s.wordsStudied / words.length : 0} color="var(--primary)">
              <span className="font-jp-serif text-lg font-bold">
                {Math.round((s.wordsStudied / Math.max(words.length, 1)) * 100)}%
              </span>
              <span className="text-[10px] text-muted-foreground">étudié</span>
            </ProgressRing>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {s.wordsStudied} / {words.length} mots · <span className="text-matcha">{s.wordsMastered} maîtrisés</span>
          </p>
        </StatCard>

        <StatCard title="Kanji" className="text-center">
          <div className="mt-2 flex justify-center">
            <ProgressRing value={kanji.length ? s.kanjiStudied / kanji.length : 0} color="var(--gold)">
              <span className="font-jp-serif text-lg font-bold">
                {Math.round((s.kanjiStudied / Math.max(kanji.length, 1)) * 100)}%
              </span>
              <span className="text-[10px] text-muted-foreground">étudié</span>
            </ProgressRing>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {s.kanjiStudied} / {kanji.length} kanji · <span className="text-matcha">{s.kanjiMastered} maîtrisés</span>
          </p>
        </StatCard>

        <StatCard title="Exercices" className="text-center">
          <div className="mt-2 flex justify-center">
            <ProgressRing value={accuracy !== null ? accuracy / 100 : 0} color="var(--matcha)">
              <span className="font-jp-serif text-lg font-bold">{accuracy !== null ? `${accuracy}%` : "—"}</span>
              <span className="text-[10px] text-muted-foreground">réussite</span>
            </ProgressRing>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {stats.attempts} tentatives · {stats.attemptsToday} aujourd&apos;hui
          </p>
        </StatCard>
      </section>

      {/* À réviser */}
      <section className="anim-fade-up rounded-2xl border bg-card p-5 shadow-sm" aria-label="Révisions du jour">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-gold" aria-hidden />
          <h2 className="font-semibold">Révisions du jour</h2>
        </div>
        {dueTotal === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Rien à réviser pour l&apos;instant — commence une session pour découvrir de nouveaux mots et kanji !
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{dueTotal} carte{dueTotal > 1 ? "s" : ""}</span> attend
            {dueTotal > 1 ? "" : ""} ta révision ({s.wordsDue} mot{s.wordsDue > 1 ? "s" : ""}, {s.kanjiDue} kanji).
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {(["words", "kanji"] as const).map((t) => {
            const total = t === "words" ? words.length : kanji.length;
            const studied = t === "words" ? s.wordsStudied : s.kanjiStudied;
            const due = t === "words" ? s.wordsDue : s.kanjiDue;
            return (
              <div key={t} className="min-w-[180px] flex-1 rounded-lg border bg-secondary/40 p-3">
                <p className="text-xs font-medium">{t === "words" ? "Mots" : "Kanji"}</p>
                <Progress className="mt-2 h-1.5" value={(studied / Math.max(total, 1)) * 100} />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {due > 0 ? `${due} à réviser` : "à jour"} · {studied}/{total}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Réinitialisation */}
      <section className="flex justify-center pb-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
              <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden />
              Réinitialiser ma progression
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Réinitialiser toute la progression ?</AlertDialogTitle>
              <AlertDialogDescription>
                Toutes tes cartes reviendront à l&apos;état neuf (mots, kanji et statistiques). Cette
                action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={reset} className="bg-destructive text-white hover:bg-destructive/90">
                Tout réinitialiser
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
