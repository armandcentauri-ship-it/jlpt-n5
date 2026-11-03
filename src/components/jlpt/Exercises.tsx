"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, Lock, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { progressKey, useAppState, useReview } from "./state";
import { SectionTitle } from "./bits";
import { useToast } from "@/hooks/use-toast";
import { AudioButton } from "./AudioButton";
import { Ruby } from "./Ruby";
import { KanaInput } from "./KanaInput";
import { checkAnswer } from "@/lib/grade";
import { finalizeKana } from "@/lib/romaji";
import type { WordItem } from "@/lib/types";
import { SETTING_KEYS, useLocalNumber } from "./settings";
import { cn } from "@/lib/utils";

type Direction = "j2f" | "f2j";
type Phase = "setup" | "session" | "done";
type Status = "answering" | "correct" | "close" | "wrong" | "revealed";

interface ExItem {
  word: WordItem & { isPhrase?: boolean };
  direction: Direction;
}

const MASTERED_DAYS = 21; // cohérent avec le tableau de bord / vocabulaire
const UNLOCK_PCT = 0.2; // niveau 2 débloqué à 20 % de vocabulaire maîtrisé

export function Exercises({ autoStart }: { autoStart?: boolean }) {
  const { words, phrases, progressMap } = useAppState();
  const { submit } = useReview();
  const { toast } = useToast();

  /* nombre de phrases mémorisé (réglé aussi depuis le tableau de bord) */
  const [size, setSize, sizeReady] = useLocalNumber(SETTING_KEYS.phrasesSize, 10);
  const [tier, setTier] = useState<1 | 2>(1);

  /* maîtrise du vocabulaire → déblocage du niveau 2 */
  const mastery = useMemo(() => {
    let mastered = 0;
    for (const w of words) {
      const p = progressMap.get(progressKey("word", w.id));
      if (p && p.intervalDays >= MASTERED_DAYS) mastered++;
    }
    const pct = words.length ? mastered / words.length : 0;
    return { mastered, pct, unlocked: pct >= UNLOCK_PCT };
  }, [words, progressMap]);

  /* phrases autonomes (table Phrase) converties au format d'exercice */
  const phraseItems = useMemo(() => {
    const norm = (s: string) => s.replace(/[。、！？\s\u3000]/g, "");
    const seen = new Set<string>();
    const out: (WordItem & { isPhrase?: boolean })[] = [];
    for (const p of phrases) {
      const key = norm(p.kana || p.ja);
      if (!p.ja || !p.fr || seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: p.id,
        wid: 0,
        word: "",
        reading: "",
        romaji: "",
        level: p.level,
        pos: [],
        meaningFr: "",
        meaningEn: "",
        theme: p.theme,
        orderIdx: 0,
        exJa: p.ja,
        exKana: p.kana,
        exFurigana: p.furigana,
        exFr: p.fr,
        exDif: "simple",
        exTier: 1,
        isPhrase: true,
      });
    }
    return out;
  }, [phrases]);

  /* pool unique : exemples de mots (simples, sans doublon des phrases) + phrases autonomes */
  const eligible = useMemo(() => {
    const norm = (s: string) => s.replace(/[。、！？\s\u3000]/g, "");
    const phraseKeys = new Set(phraseItems.map((p) => norm(p.exKana || p.exJa)));
    const fromWords = words.filter(
      (w) => w.exJa && w.exFr && w.exKana && w.exDif === "simple" && !phraseKeys.has(norm(w.exKana))
    );
    return [...fromWords, ...phraseItems];
  }, [words, phraseItems]);

  const tierCounts = useMemo(() => {
    const c = { 1: 0, 2: 0 };
    for (const w of eligible) c[(w.exTier || 2) as 1 | 2]++;
    return c;
  }, [eligible]);

  const [phase, setPhase] = useState<Phase>("setup");
  const [queue, setQueue] = useState<ExItem[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("answering");
  const [tally, setTally] = useState({ correct: 0, total: 0 });

  const buildQueue = useCallback(() => {
    const pool = eligible.filter((w) => w.exTier === tier);
    const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, size);
    const entries: ExItem[] = picked.map((word, i) => ({
      word,
      direction: i % 2 === 0 ? "j2f" : "f2j",
    }));
    setQueue(entries);
    setIndex(0);
    setInput("");
    setStatus("answering");
    setTally({ correct: 0, total: 0 });
    setPhase(entries.length ? "session" : "setup");
    if (!entries.length) {
      toast({
        title: "Pas encore de phrases disponibles",
        description:
          tier === 1
            ? "Aucune phrase facile ne correspond à ce filtre pour le moment."
            : "Aucune phrase de ce niveau ne correspond à ce filtre pour le moment.",
      });
    }
  }, [eligible, tier, size, toast]);

  /* Lancement direct depuis le tableau de bord (panneau phrases) —
     attend le chargement des réglages pour appliquer le bon nombre de phrases */
  const started = useRef(false);
  useEffect(() => {
    if (autoStart && sizeReady && !started.current) {
      started.current = true;
      buildQueue();
    }
  });

  const finishItem = (wasCorrect: boolean, mode: Direction) => {
    submit(
      queue[index].word.isPhrase ? "phrase" : "word",
      queue[index].word.id,
      wasCorrect ? 2 : 0,
      mode === "j2f" ? "ex_jp_fr" : "ex_fr_jp"
    );
    setTally((t) => ({ correct: t.correct + (wasCorrect ? 1 : 0), total: t.total + 1 }));
    if (index + 1 >= queue.length) {
      setPhase("done");
    } else {
      setIndex((i) => i + 1);
      setInput("");
      setStatus("answering");
    }
  };

  const check = () => {
    if (!input.trim()) return;
    const item = queue[index];
    if (!item) return;
    /* finalise le « n » en attente du clavier kana (f2j uniquement) */
    const candidate = item.direction === "f2j" ? finalizeKana(input) : input;
    const refs =
      item.direction === "j2f" ? [item.word.exFr] : [item.word.exKana || item.word.exJa, item.word.exJa];
    const { result } = checkAnswer(candidate, refs, item.direction === "j2f" ? "fr" : "jp");
    if (result === "correct") {
      setStatus("correct");
    } else {
      setStatus(result === "close" ? "close" : "wrong");
    }
  };

  const reveal = () => setStatus("revealed");

  /* ---------------- Configuration ---------------- */
  if (phase === "setup") {
    const pctDisplay = Math.round(mastery.pct * 100);
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-10 pt-6">
        <SectionTitle kanji="翻訳">Exercices de traduction</SectionTitle>

        <Card className="anim-fade-up">
          <CardContent className="space-y-5 p-6">
            <div>
              <p className="mb-2 text-sm font-medium">Difficulté des phrases</p>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setTier(1)}
                  aria-pressed={tier === 1}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all",
                    tier === 1
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "bg-card hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Phrases faciles</span>
                    <span className="text-xs text-muted-foreground">{tierCounts[1]} disponibles</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => mastery.unlocked && setTier(2)}
                  aria-pressed={tier === 2}
                  aria-disabled={!mastery.unlocked}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-all",
                    tier === 2 && mastery.unlocked
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "bg-card",
                    mastery.unlocked ? "hover:border-primary/40" : "cursor-not-allowed opacity-70"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold">
                      Phrases plus riches
                      {!mastery.unlocked && <Lock className="h-3.5 w-3.5 text-gold" aria-hidden />}
                    </span>
                    <span className="text-xs text-muted-foreground">{tierCounts[2]} disponibles</span>
                  </div>
                  {mastery.unlocked ? null : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Débloquées à {Math.round(UNLOCK_PCT * 100)} % de maîtrise — actuellement {pctDisplay} %
                    </p>
                  )}
                  {!mastery.unlocked && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-gold transition-all duration-500"
                        style={{ width: `${Math.min(100, (mastery.pct / UNLOCK_PCT) * 100)}%` }}
                      />
                    </div>
                  )}
                </button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Nombre de phrases</p>
              <div className="flex gap-2">
                {[5, 10, 15, 20].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant={size === n ? "default" : "outline"}
                    onClick={() => setSize(n)}
                    className="rounded-full"
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>

            <Button onClick={buildQueue} className="h-11 w-full rounded-full">
              Commencer <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---------------- Fin ---------------- */
  if (phase === "done") {
    const pct = tally.total ? Math.round((tally.correct / tally.total) * 100) : 0;
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-10 pt-6">
        <Card className="anim-pop">
          <CardContent className="space-y-5 p-8 text-center">
            <div
              className={cn(
                "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
                pct >= 80 ? "bg-matcha/15" : pct >= 50 ? "bg-gold/20" : "bg-destructive/10"
              )}
            >
              <span className="font-jp text-2xl font-bold">
                {pct >= 80 ? "上" : pct >= 50 ? "中" : "初"}
              </span>
            </div>
            <h2 className="font-jp text-2xl font-bold">
              {pct >= 80 ? "素晴らしい !" : pct >= 50 ? "いいね !" : "練習、練習 !"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tally.correct} / {tally.total} phrases correctes ({pct}%)
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={buildQueue} className="rounded-full">
                Encore une série
              </Button>
              <Button variant="outline" onClick={() => setPhase("setup")} className="rounded-full">
                Changer les réglages
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---------------- Session ---------------- */
  const item = queue[index];
  if (!item) return null;
  const w = item.word;
  const answered = status !== "answering";
  const showInput = status === "answering";

  const refs = item.direction === "j2f" ? [w.exFr] : [w.exKana || w.exJa, w.exJa];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-10 pt-6">
      {/* progression */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(index / queue.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {index + 1}/{queue.length}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setPhase("setup")} className="text-muted-foreground">
          Quitter
        </Button>
      </div>

      <Card className="anim-fade-up">
        <CardContent className="space-y-4 p-6">
          {/* consigne */}
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                item.direction === "j2f" ? "bg-gold/20 text-[#8a6d1d]" : "bg-primary/10 text-primary"
              )}
            >
              {item.direction === "j2f" ? "日本語 → Français" : "Français → 日本語"}
            </span>
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  w.exTier === 1 ? "bg-matcha/15 text-matcha" : "bg-gold/15 text-[#8a6d1d]"
                )}
              >
                {w.exTier === 1 ? "Niveau 1" : "Niveau 2"}
              </span>
              <span className="text-xs text-muted-foreground">{w.level}</span>
            </span>
          </div>

          {item.direction === "j2f" ? (
            <>
              <div className="flex items-start gap-3 rounded-xl border bg-secondary/30 p-4">
                <div className="min-w-0 flex-1">
                  {w.exFurigana ? (
                    <Ruby text={w.exFurigana} className="font-jp text-xl leading-loose md:text-2xl" />
                  ) : (
                    <p className="font-jp text-xl md:text-2xl">{w.exJa}</p>
                  )}
                  {w.word ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Mot clé : <span className="font-jp font-medium text-foreground">{w.word}</span>{" "}
                      <span className="font-jp">[{w.reading}]</span>
                    </p>
                  ) : w.theme ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Thème : <span className="font-medium text-foreground">{w.theme}</span>
                    </p>
                  ) : null}
                </div>
                <AudioButton text={w.exJa} />
              </div>
              <label htmlFor="ex-input" className="text-sm font-medium">
                Traduis cette phrase en français :
              </label>
            </>
          ) : (
            <>
              <div className="rounded-xl border bg-secondary/30 p-4">
                <p className="text-lg md:text-xl">{w.exFr}</p>
              </div>
              <label htmlFor="ex-input" className="text-sm font-medium">
                Traduis en japonais :
              </label>
            </>
          )}

          {showInput ? (
            <div className="flex gap-2">
              {item.direction === "f2j" ? (
                <KanaInput
                  value={input}
                  onChange={setInput}
                  onSubmit={check}
                  autoFocus
                  ariaLabel="Réponse en japonais"
                  placeholder="Tape ta réponse…"
                />
              ) : (
                <input
                  id="ex-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && check()}
                  autoFocus
                  aria-label="Réponse en français"
                  autoComplete="off"
                  placeholder="Tape ta réponse…"
                  className="h-12 flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-lg shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-14"
                />
              )}
              <Button onClick={check} size="lg" className="h-12 rounded-xl px-5 md:h-14" disabled={!input.trim()}>
                <Send className="mr-1 h-4 w-4" aria-hidden /> Vérifier
              </Button>
            </div>
          ) : null}

          {/* correction */}
          {answered && (
            <div
              className={cn(
                "anim-fade-up space-y-3 rounded-xl border p-4",
                status === "correct" && "border-matcha/40 bg-matcha/10",
                status === "close" && "border-gold/50 bg-gold/10",
                (status === "wrong" || status === "revealed") && "border-destructive/30 bg-destructive/5"
              )}
            >
              <div className="flex items-center gap-2">
                {status === "correct" ? (
                  <CheckCircle2 className="h-5 w-5 text-matcha" aria-hidden />
                ) : (
                  <XCircle className={cn("h-5 w-5", status === "close" ? "text-gold" : "text-destructive")} aria-hidden />
                )}
                <p className={cn("font-semibold", status === "correct" ? "text-matcha" : status === "close" ? "text-[#8a6d1d]" : "text-destructive")}>
                  {status === "correct"
                    ? "正解 ! C'est correct."
                    : status === "close"
                      ? "Presque ! On s'en approche."
                      : status === "revealed"
                        ? "Réponse révélée."
                        : "Pas tout à fait."}
                </p>
              </div>

              <div className="rounded-lg bg-card/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Réponse attendue</p>
                {item.direction === "j2f" ? (
                  <p className="mt-1 text-base">{w.exFr}</p>
                ) : (
                  <div className="mt-1 flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-jp text-lg">{w.exJa}</p>
                      {w.exKana && w.exKana !== w.exJa && (
                        <p className="font-jp text-sm text-muted-foreground">{w.exKana}</p>
                      )}
                    </div>
                    <AudioButton text={w.exJa} />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {status === "correct" ? (
                  <Button onClick={() => finishItem(true, item.direction)} className="rounded-full">
                    Continuer <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => finishItem(true, item.direction)}
                      variant="outline"
                      className="border-matcha/50 text-matcha hover:bg-matcha hover:text-matcha-foreground"
                    >
                      C&apos;était correct
                    </Button>
                    <Button onClick={() => finishItem(false, item.direction)} variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white">
                      J&apos;avais faux
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showInput && (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={reveal} className="text-muted-foreground">
            <Eye className="mr-2 h-3.5 w-3.5" aria-hidden />
            Voir la réponse
          </Button>
        </div>
      )}
    </div>
  );
}
