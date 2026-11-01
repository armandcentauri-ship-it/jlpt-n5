"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Layers, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { progressKey, useAppState, useReview } from "./state";
import { LevelBadge, SectionTitle } from "./bits";
import { AudioButton } from "./AudioButton";
import { Ruby } from "./Ruby";
import { applySm2, formatInterval } from "@/lib/srs";
import { cleanKunyomi, splitOnyomi } from "@/lib/format";
import type { Grade } from "@/lib/types";
import type { TabId } from "./tabs";
import { cn } from "@/lib/utils";

type CardType = "word" | "kanji";
type Phase = "setup" | "session" | "done";

interface QueueEntry {
  id: string;
  type: CardType;
}

const GRADES: { grade: Grade; label: string; key: string; cls: string }[] = [
  { grade: 0, label: "Encore", key: "1", cls: "border-destructive/40 text-destructive hover:bg-destructive hover:text-white" },
  { grade: 1, label: "Difficile", key: "2", cls: "border-gold/50 text-[#8a6d1d] hover:bg-gold hover:text-white" },
  { grade: 2, label: "Bien", key: "3", cls: "border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground" },
  { grade: 3, label: "Facile", key: "4", cls: "border-matcha/50 text-matcha hover:bg-matcha hover:text-matcha-foreground" },
];

export function Flashcards({
  go,
  autoStart,
  initialType = "word",
}: {
  go: (tab: TabId) => void;
  autoStart?: boolean;
  initialType?: CardType;
}) {
  const { words: allWords, kanji: allKanji, progressMap } = useAppState();
  const { submit } = useReview();

  const [phase, setPhase] = useState<Phase>("setup");
  const [type, setType] = useState<CardType>(initialType);
  const [size, setSize] = useState(15);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [tally, setTally] = useState<Record<Grade, number>>({ 0: 0, 1: 0, 2: 0, 3: 0 });

  const items = type === "word" ? allWords : allKanji;

  const counts = useMemo(() => {
    const now = Date.now();
    let due = 0;
    let fresh = 0;
    for (const it of items) {
      const p = progressMap.get(progressKey(type, it.id));
      if (!p) fresh++;
      else if (new Date(p.dueAt).getTime() <= now) due++;
    }
    return { due, fresh };
  }, [items, progressMap, type]);

  const buildQueue = useCallback(
    (mode: "normal" | "free", typeOverride?: CardType) => {
      const t = typeOverride ?? type;
      const pool = t === "word" ? allWords : allKanji;
      const now = Date.now();
      const dueList = pool
        .filter((it) => {
          const p = progressMap.get(progressKey(t, it.id));
          return p && new Date(p.dueAt).getTime() <= now;
        })
        .sort((a, b) => {
          const pa = progressMap.get(progressKey(t, a.id))!;
          const pb = progressMap.get(progressKey(t, b.id))!;
          return new Date(pa.dueAt).getTime() - new Date(pb.dueAt).getTime();
        });
      const freshList = pool.filter((it) => !progressMap.get(progressKey(t, it.id)));

      let entries: QueueEntry[];
      if (mode === "free") {
        const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, size);
        entries = shuffled.map((it) => ({ id: it.id, type: t }));
      } else {
        const dueTake = dueList.slice(0, size);
        const freshTake = freshList.slice(0, Math.max(0, Math.min(10, size - dueTake.length)));
        entries = [
          ...dueTake.map((it) => ({ id: it.id, type: t as CardType })),
          ...freshTake.map((it) => ({ id: it.id, type: t as CardType })),
        ];
        // mélange doux : on intercale les nouvelles cartes
        entries = entries.sort((a, b) => {
          const aNew = !progressMap.get(progressKey(a.type, a.id));
          const bNew = !progressMap.get(progressKey(b.type, b.id));
          if (aNew !== bNew) return Math.random() - 0.5 > 0 ? (aNew ? 1 : -1) : aNew ? -1 : 1;
          return 0;
        });
      }
      setQueue(entries);
      setIndex(0);
      setFlipped(false);
      setTally({ 0: 0, 1: 0, 2: 0, 3: 0 });
      setPhase(entries.length ? "session" : "setup");
    },
    [allWords, allKanji, progressMap, size, type]
  );

  /* Lancement direct depuis le tableau de bord (panneau vocabulaire ou kanji) */
  const started = useRef(false);
  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      buildQueue("normal", initialType);
    }
  });

  const grade = useCallback(
    (g: Grade) => {
      const entry = queue[index];
      if (!entry) return;
      submit(entry.type, entry.id, g, "flashcard");
      setTally((t) => ({ ...t, [g]: t[g] + 1 }));
      if (index + 1 >= queue.length) {
        setPhase("done");
      } else {
        setIndex((i) => i + 1);
        setFlipped(false);
      }
    },
    [index, queue, submit]
  );

  // Raccourcis clavier : espace = retourner, 1-4 = noter
  useEffect(() => {
    if (phase !== "session") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        grade((Number(e.key) - 1) as Grade);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, flipped, grade]);

  const preview = (g: Grade) => {
    const entry = queue[index];
    if (!entry) return "";
    const prev = progressMap.get(progressKey(entry.type, entry.id));
    return formatInterval(applySm2(prev, g).intervalDays);
  };

  /* ---------------- Écran de configuration ---------------- */
  if (phase === "setup") {
    const nothingDue = counts.due === 0 && counts.fresh === 0;
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-10 pt-6">
        <SectionTitle kanji="暗記">Flashcards</SectionTitle>

        <Card className="anim-fade-up">
          <CardContent className="space-y-5 p-6">
            <div>
              <p className="mb-2 text-sm font-medium">Que veux-tu réviser ?</p>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { id: "word" as CardType, title: "Mots", jp: "単語", desc: `${allWords.length} mots de vocabulaire` },
                    { id: "kanji" as CardType, title: "Kanji", jp: "漢字", desc: `${allKanji.length} kanji N5 + N4` },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setType(opt.id)}
                    aria-pressed={type === opt.id}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      type === opt.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "bg-card hover:border-primary/40"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{opt.title}</span>
                      <span className="font-jp text-lg text-primary">{opt.jp}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Taille de la session</p>
              <div className="flex gap-2">
                {[10, 15, 20, 30].map((n) => (
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

            {nothingDue && counts.fresh === 0 && counts.due === 0 ? (
              <div className="rounded-lg border border-matcha/30 bg-matcha/10 p-4 text-sm">
                <p className="font-medium text-matcha">Tout est à jour ! ✨</p>
                <p className="mt-1 text-muted-foreground">
                  Aucune carte à réviser pour le moment. Tu peux tout de même t&apos;entraîner avec une
                  session libre, ou revenir plus tard.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-secondary/50 p-4 text-sm">
                <span className="text-primary font-semibold">{counts.due} à réviser</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {Math.min(counts.fresh, Math.max(0, size - counts.due))} nouvelles cartes
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => buildQueue("normal")}
                disabled={counts.due === 0 && counts.fresh === 0}
                className="h-11 flex-1 rounded-full"
              >
                <Layers className="mr-2 h-4 w-4" aria-hidden />
                Commencer la session
              </Button>
              <Button variant="outline" onClick={() => buildQueue("free")} className="h-11 rounded-full">
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
                Session libre
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---------------- Écran de fin ---------------- */
  if (phase === "done") {
    const total = queue.length;
    const good = tally[2] + tally[3];
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-10 pt-6">
        <Card className="anim-pop">
          <CardContent className="space-y-5 p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-matcha/15">
              <CheckCircle2 className="h-8 w-8 text-matcha" aria-hidden />
            </div>
            <h2 className="font-jp text-2xl font-bold">お疲れ様 !</h2>
            <p className="text-sm text-muted-foreground">
              {total} carte{total > 1 ? "s" : ""} révisée{total > 1 ? "s" : ""} · {good} réussie{good > 1 ? "s" : ""}
            </p>
            <div className="mx-auto grid max-w-xs grid-cols-4 gap-2 text-center">
              {GRADES.map((g) => (
                <div key={g.grade} className="rounded-lg border bg-secondary/40 p-2">
                  <p className={cn("text-lg font-bold", g.cls.split(" ").find((c) => c.startsWith("text-")))}>{tally[g.grade]}</p>
                  <p className="text-[10px] text-muted-foreground">{g.label}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={() => setPhase("setup")} className="rounded-full">
                Nouvelle session
              </Button>
              <Button variant="outline" onClick={() => go("dashboard")} className="rounded-full">
                Tableau de bord
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ---------------- Session ---------------- */
  const entry = queue[index];
  if (!entry) return null;
  const word = entry.type === "word" ? allWords.find((w) => w.id === entry.id) : undefined;
  const curKanji = entry.type === "kanji" ? allKanji.find((k) => k.id === entry.id) : undefined;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-10 pt-6">
      {/* progression de session */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((index + (flipped ? 0.5 : 0)) / queue.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {index + 1}/{queue.length}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setPhase("setup")} className="text-muted-foreground">
          Quitter
        </Button>
      </div>

      {/* carte */}
      <div className="flip-scene select-none" onClick={() => setFlipped((f) => !f)}>
        <div className={cn("flip-inner", flipped && "flipped")}>
          {/* recto */}
          <Card className="flip-face min-h-[340px] cursor-pointer md:min-h-[400px]">
            <CardContent className="flex min-h-[340px] flex-col items-center justify-center gap-4 p-6 md:min-h-[400px]">
              {entry.type === "word" && word ? (
                <>
                  <LevelBadge level={word.level} />
                  <p className="font-jp break-all text-center text-6xl font-semibold md:text-7xl">
                    {word.word}
                  </p>
                  <AudioButton text={word.word} size="icon-lg" />
                </>
              ) : curKanji ? (
                <>
                  <LevelBadge level={curKanji.level} />
                  <p className="font-jp text-center text-8xl font-semibold">{curKanji.character}</p>
                </>
              ) : null}
            </CardContent>
          </Card>

          {/* verso */}
          <Card className="flip-face flip-back min-h-[340px] cursor-pointer md:min-h-[400px]">
            <CardContent className="custom-scroll min-h-[340px] max-h-[70vh] overflow-y-auto p-6 md:min-h-[400px]">
              {entry.type === "word" && word ? (
                <div className="flex h-full flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-jp text-3xl font-semibold">{word.word}</p>
                      <p className="font-jp mt-1 text-lg text-primary">{word.reading}</p>
                      {word.romaji && <p className="text-xs italic text-muted-foreground">{word.romaji}</p>}
                    </div>
                    <div className="flex flex-col gap-2">
                      <AudioButton text={word.word} />
                      <LevelBadge level={word.level} className="ml-auto" />
                    </div>
                  </div>

                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-lg font-medium">{word.meaningFr || word.meaningEn}</p>
                    {word.meaningFr && word.meaningEn && (
                      <p className="mt-1 text-xs text-muted-foreground">{word.meaningEn}</p>
                    )}
                  </div>

                  {word.exJa && (
                    <div className="rounded-lg border p-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          {word.exFurigana ? (
                            <Ruby text={word.exFurigana} className="font-jp text-base" />
                          ) : (
                            <p className="font-jp text-base">{word.exJa}</p>
                          )}
                          {word.exFr && <p className="mt-1.5 text-sm italic text-muted-foreground">{word.exFr}</p>}
                        </div>
                        <AudioButton text={word.exJa} />
                      </div>
                    </div>
                  )}
                </div>
              ) : curKanji ? (
                <div className="flex h-full flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                  {/* kanji + lectures les plus usitées directement sous le caractère */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <p className="font-jp text-6xl font-semibold md:text-7xl">{curKanji.character}</p>
                      <div className="space-y-1.5">
                        {splitOnyomi(curKanji.onyomi).length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-[#8a6d1d]"
                              title="Lecture on (chinoise)"
                            >
                              音
                            </span>
                            {splitOnyomi(curKanji.onyomi)
                              .slice(0, 2)
                              .map((o) => (
                                <span
                                  key={o}
                                  className="font-jp rounded-md bg-gold/15 px-2 py-0.5 text-base font-semibold text-[#8a6d1d]"
                                >
                                  {o}
                                </span>
                              ))}
                          </div>
                        )}
                        {cleanKunyomi(curKanji.kunyomi).length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground"
                              title="Lecture kun (japonaise)"
                            >
                              訓
                            </span>
                            {cleanKunyomi(curKanji.kunyomi)
                              .slice(0, 2)
                              .map((k) => (
                                <span key={k} className="font-jp rounded-md bg-secondary px-2 py-0.5 text-base font-semibold">
                                  {k}
                                </span>
                              ))}
                          </div>
                        )}
                        <p className="text-[11px] text-muted-foreground">{curKanji.strokes} traits · lectures les plus usitées</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <AudioButton text={curKanji.character} />
                      <LevelBadge level={curKanji.level} />
                    </div>
                  </div>

                  {/* autres lectures (listées, plus discrètes) */}
                  {(splitOnyomi(curKanji.onyomi).length > 2 || cleanKunyomi(curKanji.kunyomi).length > 2) && (
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Autres lectures :{" "}
                      {[...splitOnyomi(curKanji.onyomi).slice(2), ...cleanKunyomi(curKanji.kunyomi).slice(2)].join(" · ")}
                    </p>
                  )}

                  {/* sens principal, bien visible */}
                  <div className="rounded-lg bg-secondary/50 p-3">
                    <p className="text-xl font-semibold">
                      {curKanji.meaningsFr[0] ?? curKanji.meaningsEn[0] ?? "—"}
                    </p>
                    {curKanji.meaningsFr.length > 1 && (
                      <p className="mt-0.5 text-sm text-muted-foreground">aussi : {curKanji.meaningsFr.slice(1).join(" ; ")}</p>
                    )}
                  </div>

                  {curKanji.examples.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mots avec ce kanji</p>
                      <div className="mt-1 space-y-1.5">
                        {curKanji.examples.slice(0, 3).map((ex) => (
                          <div
                            key={ex.word}
                            className="flex items-baseline justify-between gap-2 rounded-md border bg-card px-2.5 py-1.5"
                          >
                            <span className="text-sm">
                              <span className="font-jp font-medium">{ex.word}</span>
                              {ex.reading && <span className="font-jp text-xs text-muted-foreground"> [{ex.reading}]</span>}
                            </span>
                            <span className="text-right text-xs text-muted-foreground">{ex.fr}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* notation */}
      {flipped ? (
        <div className="anim-fade-up grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GRADES.map((g) => (
            <Button
              key={g.grade}
              variant="outline"
              onClick={() => grade(g.grade)}
              className={cn("h-14 flex-col gap-0.5 rounded-xl", g.cls)}
            >
              <span className="text-sm font-semibold">{g.label}</span>
              <span className="text-[10px] opacity-70">{preview(g.grade)}</span>
            </Button>
          ))}
        </div>
      ) : (
        <Button onClick={() => setFlipped(true)} className="h-12 w-full rounded-xl text-base" size="lg">
          Voir la réponse <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
        </Button>
      )}
      <p className="text-center text-[11px] text-muted-foreground">
        Espace : retourner · 1-4 : noter
      </p>
    </div>
  );
}
