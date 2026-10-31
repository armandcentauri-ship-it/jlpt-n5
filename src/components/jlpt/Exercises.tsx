"use client";

import React, { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { progressKey, useAppState, useReview } from "./state";
import { SectionTitle, FilterChip } from "./bits";
import { useToast } from "@/hooks/use-toast";
import { AudioButton } from "./AudioButton";
import { Ruby } from "./Ruby";
import { KanaInput } from "./KanaInput";
import { checkAnswer } from "@/lib/grade";
import type { WordItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Direction = "j2f" | "f2j";
type Phase = "setup" | "session" | "done";
type Status = "answering" | "correct" | "close" | "wrong" | "revealed";

interface ExItem {
  word: WordItem;
  direction: Direction;
}

const WEEK = 7 * 24 * 3600 * 1000;

export function Exercises() {
  const { words, progressMap } = useAppState();
  const { submit } = useReview();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>("setup");
  const [size, setSize] = useState(10);
  const [scope, setScope] = useState<"recent" | "all">("recent");
  const [queue, setQueue] = useState<ExItem[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("answering");
  const [tally, setTally] = useState({ correct: 0, total: 0 });

  const pools = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - WEEK;
    const recentlyStudied: WordItem[] = [];
    const others: WordItem[] = [];
    const isSimple = (w: WordItem) => w.exJa && w.exFr && w.exKana && w.exDif === "simple";
    for (const w of words) {
      const p = progressMap.get(progressKey("word", w.id));
      if (p?.lastReviewedAt && new Date(p.lastReviewedAt).getTime() >= weekAgo) {
        if (isSimple(w)) recentlyStudied.push(w);
      } else if (isSimple(w)) {
        others.push(w);
      }
    }
    return { recentlyStudied, others };
  }, [words, progressMap]);

  const buildQueue = () => {
    const eligible = (pool: WordItem[]) =>
      pool.filter((w) => w.exJa && w.exFr && w.exKana && w.exDif === "simple");
    let picked: WordItem[] = [];
    if (scope === "recent") {
      const recent = eligible(pools.recentlyStudied);
      picked = recent.slice(0, size);
      if (picked.length < size) {
        const rest = eligible(pools.others).filter((w) => !picked.includes(w));
        // d'abord les jamais étudiés (ordre du livre), puis le reste
        const fresh = rest.filter((w) => !progressMap.get(progressKey("word", w.id)));
        const seen = rest.filter((w) => progressMap.get(progressKey("word", w.id)));
        picked = [...picked, ...fresh.slice(0, size - picked.length)];
        if (picked.length < size) {
          picked = [...picked, ...seen.sort(() => Math.random() - 0.5).slice(0, size - picked.length)];
        }
      }
    } else {
      const all = eligible(words);
      // moitié récents, moitié hasard pour la variété
      const recent = eligible(pools.recentlyStudied).slice(0, Math.ceil(size / 2));
      const rest = all.filter((w) => !recent.includes(w)).sort(() => Math.random() - 0.5);
      picked = [...recent, ...rest].slice(0, size);
    }
    picked.sort(() => Math.random() - 0.5);
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
        description: "Aucune phrase simple ne correspond à ce filtre pour le moment.",
      });
    }
  };

  const finishItem = (wasCorrect: boolean, mode: Direction) => {
    submit("word", queue[index].word.id, wasCorrect ? 2 : 0, mode === "j2f" ? "ex_jp_fr" : "ex_fr_jp");
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
    const refs =
      item.direction === "j2f" ? [item.word.exFr] : [item.word.exKana || item.word.exJa, item.word.exJa];
    const { result } = checkAnswer(input, refs, item.direction === "j2f" ? "fr" : "jp");
    if (result === "correct") {
      setStatus("correct");
    } else {
      setStatus(result === "close" ? "close" : "wrong");
    }
  };

  const reveal = () => setStatus("revealed");

  /* ---------------- Configuration ---------------- */
  if (phase === "setup") {
    const nRecent = pools.recentlyStudied.filter((w) => w.exJa && w.exFr && w.exKana).length;
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-10 pt-6">
        <SectionTitle kanji="翻訳">Exercices de traduction</SectionTitle>

        <Card className="anim-fade-up">
          <CardContent className="space-y-5 p-6">
            <div className="rounded-lg border bg-secondary/40 p-4 text-sm text-muted-foreground">
              <p>
                Traduis des phrases <span className="font-medium text-foreground">dans les deux sens</span> :
                japonais → français, puis français → japonais. Les phrases reprennent le vocabulaire
                que tu viens d&apos;étudier. La saisie japonaise se fait en romaji, converti
                automatiquement en kana (touche <span className="font-jp font-semibold">あ</span>).
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Vocabulaire visé</p>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={scope === "recent"} onClick={() => setScope("recent")}>
                  Récemment vu ({nRecent})
                </FilterChip>
                <FilterChip active={scope === "all"} onClick={() => setScope("all")}>
                  Tout le vocabulaire
                </FilterChip>
              </div>
              {scope === "recent" && nRecent === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Aucun mot étudié récemment — les premières sessions piocheront dans les nouveaux mots
                  (ordre du livre).
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Nombre de phrases</p>
              <div className="flex gap-2">
                {[5, 10, 15].map((n) => (
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
              <span className="font-jp-serif text-2xl font-bold">
                {pct >= 80 ? "上" : pct >= 50 ? "中" : "初"}
              </span>
            </div>
            <h2 className="font-jp-serif text-2xl font-bold">
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
            <span className="text-xs text-muted-foreground">{w.level}</span>
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
                  <p className="mt-2 text-xs text-muted-foreground">
                    Mot clé : <span className="font-jp font-medium text-foreground">{w.word}</span>{" "}
                    <span className="font-jp">[{w.reading}]</span>
                  </p>
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
                Traduis en japonais (romaji accepté, ex. <span className="font-jp">watashi</span> →{" "}
                <span className="font-jp">わたし</span>) :
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

              {w.exJa && item.direction === "j2f" && (
                <div className="rounded-lg border bg-card/60 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Phrase japonaise</p>
                  {w.exFurigana ? (
                    <Ruby text={w.exFurigana} className="font-jp text-base" />
                  ) : (
                    <p className="font-jp text-base">{w.exJa}</p>
                  )}
                </div>
              )}

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
            Voir la réponse (compté comme erreur)
          </Button>
        </div>
      )}
    </div>
  );
}
