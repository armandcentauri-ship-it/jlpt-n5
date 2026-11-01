"use client";

import React, { useMemo } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  MessagesSquare,
  PenLine,
  Repeat,
  Trash2,
} from "lucide-react";
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
import { ProgressRing } from "./bits";
import { buildVerbList } from "@/lib/conjugation";
import type { TabId } from "./tabs";
import { cn } from "@/lib/utils";

const MASTERED_DAYS = 21;

type Domain = "vocab" | "kanji" | "phrases" | "conj";

interface PanelDef {
  id: Domain;
  tab: TabId;
  jp: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  /* lancement : accède directement à l'exercice (session démarrée) */
  launch: (go: (t: TabId, autoStart?: boolean, cardType?: "word" | "kanji") => void) => void;
  /* palette zen — 4 couleurs distinctes */
  iconCls: string;
  jpCls: string;
  borderCls: string;
  badgeCls: string;
  todayCls: string;
}

const PANELS: PanelDef[] = [
  {
    id: "vocab",
    tab: "flashcards",
    jp: "単語",
    title: "Vocabulaire",
    desc: "Flashcards de mots, répétition espacée",
    icon: BookOpen,
    launch: (go) => go("flashcards", true, "word"),
    iconCls: "bg-matcha/15 text-matcha",
    jpCls: "text-matcha",
    borderCls: "hover:border-matcha/60",
    badgeCls: "bg-matcha/15 text-matcha",
    todayCls: "border-matcha/50 bg-matcha/5",
  },
  {
    id: "kanji",
    tab: "flashcards",
    jp: "漢字",
    title: "Kanji",
    desc: "Caractères N5 + N4, sens et lectures",
    icon: PenLine,
    launch: (go) => go("flashcards", true, "kanji"),
    iconCls: "bg-gold/20 text-[#8a6d1d]",
    jpCls: "text-[#8a6d1d]",
    borderCls: "hover:border-gold/60",
    badgeCls: "bg-gold/20 text-[#8a6d1d]",
    todayCls: "border-gold/60 bg-gold/5",
  },
  {
    id: "phrases",
    tab: "exercises",
    jp: "文章",
    title: "Phrases",
    desc: "Traduction JP ⇄ FR, tirage aléatoire",
    icon: MessagesSquare,
    launch: (go) => go("exercises", true),
    iconCls: "bg-primary/10 text-primary",
    jpCls: "text-primary",
    borderCls: "hover:border-primary/60",
    badgeCls: "bg-primary/10 text-primary",
    todayCls: "border-primary/50 bg-primary/5",
  },
  {
    id: "conj",
    tab: "conjugation",
    jp: "動詞",
    title: "Conjugaison",
    desc: "Entraînement aux formes verbales",
    icon: Repeat,
    launch: (go) => go("conjugation", true),
    iconCls: "bg-fuji/15 text-fuji",
    jpCls: "text-fuji",
    borderCls: "hover:border-fuji/60",
    badgeCls: "bg-fuji/15 text-fuji",
    todayCls: "border-fuji/50 bg-fuji/5",
  },
];

export function Dashboard({ go }: { go: (tab: TabId, autoStart?: boolean, cardType?: "word" | "kanji") => void }) {
  const { words, kanji, progressMap, stats } = useAppState();
  const { toast } = useToast();

  /* ---- alternance quotidienne : jour impair = vocabulaire + conjugaison, pair = kanji + phrases ---- */
  const program = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const doy = Math.floor((now.getTime() - start.getTime()) / 86400000);
    const dayA = doy % 2 === 1;
    return {
      today: (dayA ? ["vocab", "conj"] : ["kanji", "phrases"]) as Domain[],
      todayLabel: dayA ? "Vocabulaire + Conjugaison" : "Kanji + Phrases",
      tomorrowLabel: dayA ? "Kanji + Phrases" : "Vocabulaire + Conjugaison",
      dateStr: now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
    };
  }, []);

  /* ---- compteurs ---- */
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

  const metrics = useMemo(() => {
    const phraseCount = words.filter((w) => w.exJa && w.exFr && w.exKana && w.exDif === "simple").length;
    return {
      vocab: `${s.wordsDue > 0 ? `${s.wordsDue} carte${s.wordsDue > 1 ? "s" : ""} à réviser` : "à jour"} · ${s.wordsStudied}/${words.length} étudiés`,
      kanji: `${s.kanjiDue > 0 ? `${s.kanjiDue} carte${s.kanjiDue > 1 ? "s" : ""} à réviser` : "à jour"} · ${s.kanjiStudied}/${kanji.length} étudiés`,
      phrases: `${phraseCount} phrases · tirage aléatoire`,
      conj: `${buildVerbList(words).length} verbes · formes N5 & N4`,
    } as Record<Domain, string>;
  }, [words, kanji.length, s]);

  const panels = useMemo(
    () =>
      [...PANELS].sort(
        (a, b) => Number(program.today.includes(b.id)) - Number(program.today.includes(a.id))
      ),
    [program]
  );

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
      {/* ---- Programme du jour ---- */}
      <section className="anim-fade-up space-y-4" aria-label="Programme du jour">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold md:text-2xl">
              <CalendarDays className="h-5 w-5 text-primary" aria-hidden />
              Programme du jour
            </h1>
            <p className="mt-0.5 text-sm capitalize text-muted-foreground">{program.dateStr}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Aujourd&apos;hui : <span className="font-semibold text-foreground">{program.todayLabel}</span>
            <span className="mx-1.5 text-border">|</span>
            Demain : {program.tomorrowLabel}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {panels.map((p) => {
            const inProgram = program.today.includes(p.id);
            const done = stats.doneToday[p.id];
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => p.launch(go)}
                className={cn(
                  "group rounded-2xl border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md",
                  p.borderCls,
                  inProgram && p.todayCls
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", p.iconCls)}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                      inProgram ? p.badgeCls : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {inProgram ? "Au programme" : "Bonus"}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className={cn("font-jp text-lg font-bold", p.jpCls)} aria-hidden>
                    {p.jp}
                  </span>
                  <span className="text-base font-semibold">{p.title}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.desc}</p>
                <p className="mt-2 text-xs font-medium text-foreground/80">{metrics[p.id]}</p>
                <div className="mt-3 flex items-center gap-1.5 text-xs">
                  {done ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-matcha" aria-hidden />
                      <span className="font-medium text-matcha">Fait aujourd&apos;hui</span>
                    </>
                  ) : (
                    <>
                      <Circle className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
                      <span className="text-muted-foreground">Pas encore aujourd&apos;hui</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---- Progression ---- */}
      <section className="anim-fade-up grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Progression">
        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <ProgressRing value={words.length ? s.wordsStudied / words.length : 0} color="var(--matcha)" size={72} stroke={8}>
            <span className="text-base font-bold">
              {Math.round((s.wordsStudied / Math.max(words.length, 1)) * 100)}%
            </span>
          </ProgressRing>
          <p className="mt-2 text-xs font-medium">Vocabulaire</p>
          <p className="text-[11px] text-muted-foreground">
            {s.wordsStudied}/{words.length} · <span className="text-matcha">{s.wordsMastered} maîtrisés</span>
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <ProgressRing value={kanji.length ? s.kanjiStudied / kanji.length : 0} color="var(--gold)" size={72} stroke={8}>
            <span className="text-base font-bold">
              {Math.round((s.kanjiStudied / Math.max(kanji.length, 1)) * 100)}%
            </span>
          </ProgressRing>
          <p className="mt-2 text-xs font-medium">Kanji</p>
          <p className="text-[11px] text-muted-foreground">
            {s.kanjiStudied}/{kanji.length} · <span className="text-[#8a6d1d]">{s.kanjiMastered} maîtrisés</span>
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 text-center shadow-sm">
          <ProgressRing value={accuracy !== null ? accuracy / 100 : 0} color="var(--primary)" size={72} stroke={8}>
            <span className="text-base font-bold">{accuracy !== null ? `${accuracy}%` : "—"}</span>
          </ProgressRing>
          <p className="mt-2 text-xs font-medium">Exercices</p>
          <p className="text-[11px] text-muted-foreground">
            {stats.attemptsToday} tentative{stats.attemptsToday > 1 ? "s" : ""} aujourd&apos;hui
          </p>
        </div>
      </section>

      {/* ---- Rappel des révisions ---- */}
      <section className="anim-fade-up rounded-2xl border bg-card p-5 shadow-sm" aria-label="Révisions du jour">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {s.wordsDue + s.kanjiDue === 0 ? (
              <>Rien à réviser pour l&apos;instant — les nouveaux éléments arrivent au fil des sessions.</>
            ) : (
              <>
                <span className="font-semibold text-foreground">{s.wordsDue + s.kanjiDue} carte(s)</span> attendent ta
                révision dans les flashcards ({s.wordsDue} mot{s.wordsDue > 1 ? "s" : ""}, {s.kanjiDue} kanji).
              </>
            )}
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(["words", "kanji"] as const).map((t) => {
            const total = t === "words" ? words.length : kanji.length;
            const studied = t === "words" ? s.wordsStudied : s.kanjiStudied;
            const due = t === "words" ? s.wordsDue : s.kanjiDue;
            return (
              <div key={t} className="rounded-lg border bg-secondary/40 p-3">
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

      {/* ---- Réinitialisation ---- */}
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
