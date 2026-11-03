"use client";

import React, { useMemo } from "react";
import { Check, Moon, Trash2 } from "lucide-react";
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
import { progressKey, useAppState } from "./state";
import { buildVerbList, N5_FORM_KEYS } from "@/lib/conjugation";
import { SETTING_KEYS, useLocalBool, useLocalNumber } from "./settings";
import type { TabId } from "./tabs";
import { cn } from "@/lib/utils";

type Domain = "vocab" | "kanji" | "phrases" | "conj";

interface PanelDef {
  id: Domain;
  tab: TabId;
  jp: string;
  title: string;
  launch: (go: (t: TabId, autoStart?: boolean, cardType?: "word" | "kanji") => void) => void;
  /* tuile unie (au programme aujourd'hui) */
  solidCls: string;
  /* tuile teintée (bonus) */
  tintCls: string;
  /* pastille « fait » */
  checkCls: string;
  ringCls: string;
}

const PANELS: PanelDef[] = [
  {
    id: "vocab",
    tab: "flashcards",
    jp: "単語",
    title: "Vocabulaire",
    launch: (go) => go("flashcards", true, "word"),
    solidCls: "bg-[oklch(0.54_0.15_148)] hover:bg-[oklch(0.48_0.155_148)]",
    tintCls: "bg-matcha/15 text-matcha hover:bg-matcha/25",
    checkCls: "text-matcha",
    ringCls: "border-matcha/50",
  },
  {
    id: "kanji",
    tab: "flashcards",
    jp: "漢字",
    title: "Kanji",
    launch: (go) => go("flashcards", true, "kanji"),
    solidCls: "bg-[oklch(0.60_0.15_72)] hover:bg-[oklch(0.54_0.155_72)]",
    tintCls: "bg-gold/20 text-[#8a6d1d] hover:bg-gold/30",
    checkCls: "text-[#8a6d1d]",
    ringCls: "border-gold/60",
  },
  {
    id: "phrases",
    tab: "exercises",
    jp: "文章",
    title: "Phrases",
    launch: (go) => go("exercises", true),
    solidCls: "bg-[oklch(0.54_0.19_29)] hover:bg-[oklch(0.48_0.195_29)]",
    tintCls: "bg-primary/12 text-primary hover:bg-primary/20",
    checkCls: "text-primary",
    ringCls: "border-primary/50",
  },
  {
    id: "conj",
    tab: "conjugation",
    jp: "動詞",
    title: "Conjugaison",
    launch: (go) => go("conjugation", true),
    solidCls: "bg-[oklch(0.50_0.17_300)] hover:bg-[oklch(0.44_0.175_300)]",
    tintCls: "bg-fuji/15 text-fuji hover:bg-fuji/25",
    checkCls: "text-fuji",
    ringCls: "border-fuji/50",
  },
];

export function Dashboard({ go }: { go: (tab: TabId, autoStart?: boolean, cardType?: "word" | "kanji") => void }) {
  const { stats, words, kanji, phrases, progressMap } = useAppState();
  const { toast } = useToast();

  /* nombre de cartes / phrases par session — mémorisé et partagé avec les écrans */
  const [cardsSize, setCardsSize] = useLocalNumber(SETTING_KEYS.cardsSize, 15);
  const [phrasesSize, setPhrasesSize] = useLocalNumber(SETTING_KEYS.phrasesSize, 10);
  /* lecture automatique de la réponse (flashcards, exercices, conjugaison) */
  const [autoAudio, setAutoAudio] = useLocalBool(SETTING_KEYS.autoAudio, true);

  /* alternance quotidienne : jour impair = vocabulaire + conjugaison, pair = kanji + phrases */
  const today = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const doy = Math.floor((now.getTime() - start.getTime()) / 86400000);
    return (doy % 2 === 1 ? ["vocab", "conj"] : ["kanji", "phrases"]) as Domain[];
  }, []);

  /* progression globale : maîtrise = intervalle SRS ≥ 21 j (cohérent avec le reste de l'app) */
  const prog = useMemo(() => {
    const calc = (items: { id: string }[], type: string) => {
      let seen = 0;
      let mastered = 0;
      for (const it of items) {
        const p = progressMap.get(progressKey(type, it.id));
        if (p) {
          seen++;
          if (p.intervalDays >= 21) mastered++;
        }
      }
      return { total: items.length, seen, mastered };
    };
    /* conjugaison : paires (verbe N5 × forme N5) — même périmètre que le panneau par défaut */
    const conjPairs = buildVerbList(words)
      .filter((v) => v.level === "N5")
      .flatMap((v) => N5_FORM_KEYS.map((f) => ({ id: `${v.id}:${f}` })));
    return {
      vocab: calc(words, "word"),
      kanji: calc(kanji, "kanji"),
      phrases: calc(phrases, "phrase"),
      conj: calc(conjPairs, "conj"),
    };
  }, [words, kanji, phrases, progressMap]);

  const reset = async () => {
    try {
      await fetch("/api/reset", { method: "POST" });
      window.location.reload();
    } catch {
      toast({ title: "Erreur", description: "La réinitialisation a échoué.", variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 pb-8 pt-6">
      <div className="anim-fade-up grid grid-cols-2 gap-3 md:gap-5" aria-label="Exercices du jour">
        {PANELS.map((p) => {
          const inProgram = today.includes(p.id);
          const done = stats.doneToday[p.id];
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => p.launch(go)}
              aria-label={`${p.title}${done ? " — fait aujourd'hui" : inProgram ? "" : " — repos aujourd'hui"}`}
              className={cn(
                "group relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-3xl p-5 text-left shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg active:scale-[0.99] md:min-h-[180px] md:p-6",
                inProgram ? cn(p.solidCls, "text-white") : p.tintCls
              )}
            >
              {/* grand glyphe en fond */}
              <span
                aria-hidden
                className={cn(
                  "font-jp pointer-events-none absolute -bottom-4 -right-2 select-none text-7xl font-bold leading-none md:text-8xl",
                  inProgram ? "text-white/15" : "opacity-[0.12]"
                )}
              >
                {p.jp}
              </span>

              {/* pastille fait / à faire / repos */}
              <span className="flex justify-end">
                {done ? (
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md transition-transform group-hover:scale-110",
                      p.checkCls
                    )}
                  >
                    <Check className="h-5 w-5" strokeWidth={3} aria-hidden />
                  </span>
                ) : inProgram ? (
                  <span
                    aria-hidden
                    className="h-8 w-8 rounded-full border-[2.5px] border-white/70"
                  />
                ) : (
                  <span
                    aria-hidden
                    title="Repos aujourd'hui — au programme un jour sur deux"
                    className="flex h-8 w-8 items-center justify-center"
                  >
                    <Moon className={cn("h-5 w-5 opacity-50", p.checkCls)} strokeWidth={2.5} />
                  </span>
                )}
              </span>

              <span className="relative">
                <span className={cn("font-jp block text-2xl font-bold leading-tight md:text-3xl", !inProgram && "opacity-90")}>
                  {p.jp}
                </span>
                <span className="mt-1 block text-base font-bold md:text-lg">{p.title}</span>
                {!inProgram && !done && (
                  <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-widest opacity-60">
                    Repos aujourd&apos;hui
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* progression globale — libellés français, couleur = tuile correspondante */}
      <div className="anim-fade-up mt-6 space-y-2.5" aria-label="Progression globale">
        <MasteryBar
          label="Vocabulaire"
          total={prog.vocab.total}
          seen={prog.vocab.seen}
          mastered={prog.vocab.mastered}
          soft="bg-matcha/30"
          solid="bg-matcha"
        />
        <MasteryBar
          label="Kanji"
          total={prog.kanji.total}
          seen={prog.kanji.seen}
          mastered={prog.kanji.mastered}
          soft="bg-gold/40"
          solid="bg-gold"
        />
        <MasteryBar
          label="Phrases"
          total={prog.phrases.total}
          seen={prog.phrases.seen}
          mastered={prog.phrases.mastered}
          soft="bg-primary/25"
          solid="bg-primary"
        />
        <MasteryBar
          label="Conjugaison"
          total={prog.conj.total}
          seen={prog.conj.seen}
          mastered={prog.conj.mastered}
          soft="bg-fuji/25"
          solid="bg-fuji"
        />
      </div>

      {/* réglage des sessions — appliqué quand on lance une activité depuis les cartes */}
      <div className="anim-fade-up mt-4 rounded-2xl border bg-card px-4 py-2" aria-label="Réglage des sessions">
        <SizeRow
          jp="暗記"
          label="Cartes par session"
          options={[5, 10, 15, 20, 30]}
          value={cardsSize}
          onChange={setCardsSize}
        />
        <SizeRow
          jp="文章"
          label="Phrases par session"
          options={[5, 10, 15, 20]}
          value={phrasesSize}
          onChange={setPhrasesSize}
        />
        <BoolRow
          jp="音"
          label="Audio automatique des réponses"
          value={autoAudio}
          onChange={setAutoAudio}
        />
      </div>

      {/* réinitialisation — discret */}
      <div className="mt-6 flex justify-center">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              aria-label="Réinitialiser ma progression"
              title="Réinitialiser ma progression"
              className="rounded-full p-2 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
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
      </div>
    </div>
  );
}

/** Barre de progression bicolore : couche claire = vu, couche pleine = maîtrisé. */
function MasteryBar({
  label,
  total,
  seen,
  mastered,
  soft,
  solid,
}: {
  label: string;
  total: number;
  seen: number;
  mastered: number;
  soft: string;
  solid: string;
}) {
  const pctSeen = total ? (seen / total) * 100 : 0;
  const pctMastered = total ? (mastered / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate text-sm font-semibold text-muted-foreground" aria-hidden>
        {label}
      </span>
      <div
        className="relative h-3 flex-1 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((mastered / Math.max(1, total)) * 100)}
        aria-label={`${mastered} sur ${total} maîtrisés`}
        title={`${mastered}/${total} maîtrisés · ${seen - mastered} en cours`}
      >
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-700", soft)}
          style={{ width: `${pctSeen}%` }}
        />
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-700", solid)}
          style={{ width: `${pctMastered}%` }}
        />
      </div>
      <span className="w-14 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
        {mastered}/{total}
      </span>
    </div>
  );
}

/** Ligne de réglage binaire (Oui / Non). */
function BoolRow({
  jp,
  label,
  value,
  onChange,
}: {
  jp: string;
  label: string;
  value: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <div className="py-2 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-border/60">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 sm:flex-nowrap">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="font-jp w-8 shrink-0 text-sm font-semibold text-muted-foreground" aria-hidden>
            {jp}
          </span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
          {([
            { v: true, l: "Oui" },
            { v: false, l: "Non" },
          ] as const).map((o) => (
            <button
              key={o.l}
              type="button"
              role="radio"
              aria-checked={value === o.v}
              onClick={() => onChange(o.v)}
              className={cn(
                "h-7 rounded-full px-3 text-xs font-semibold transition-colors",
                value === o.v
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              )}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Ligne de réglage : nombre d'éléments par session (puces de sélection compactes). */
function SizeRow({
  jp,
  label,
  options,
  value,
  onChange,
}: {
  jp: string;
  label: string;
  options: number[];
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="py-2 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-border/60">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 sm:flex-nowrap">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="font-jp w-8 shrink-0 text-sm font-semibold text-muted-foreground" aria-hidden>
            {jp}
          </span>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={cn(
              "h-7 w-9 rounded-full text-xs font-semibold tabular-nums transition-colors",
              value === n
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {n}
          </button>
        ))}
        </div>
      </div>
    </div>
  );
}
