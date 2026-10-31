"use client";

import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppState, progressKey } from "./state";
import { FilterChip, LevelBadge } from "./bits";
import { AudioButton } from "./AudioButton";
import { cleanKunyomi, splitOnyomi } from "@/lib/format";
import { normalizeFr } from "@/lib/grade";
import { cn } from "@/lib/utils";

type LevelFilter = "all" | "N5" | "N4";

export function KanjiExplorer() {
  const { kanji, progressMap } = useAppState();
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [selected, setSelected] = useState<(typeof kanji)[number] | null>(null);

  const filtered = useMemo(() => {
    const q = normalizeFr(query.trim().toLowerCase());
    return kanji.filter((k) => {
      if (level !== "all" && k.level !== level) return false;
      if (!q) return true;
      const inFr = k.meaningsFr.some((m) => normalizeFr(m).includes(q));
      const inEn = k.meaningsEn.some((m) => m.toLowerCase().includes(q));
      const inReadings =
        splitOnyomi(k.onyomi).some((r) => r.toLowerCase().includes(q)) ||
        cleanKunyomi(k.kunyomi).some((r) => r.includes(q));
      return k.character.includes(query) || inFr || inEn || inReadings;
    });
  }, [kanji, level, query]);

  const counts = useMemo(
    () => ({
      all: kanji.length,
      N5: kanji.filter((k) => k.level === "N5").length,
      N4: kanji.filter((k) => k.level === "N4").length,
    }),
    [kanji]
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-10 pt-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-jp-serif text-2xl font-bold">
          漢字 <span className="text-lg text-muted-foreground">· Kanji N5 + N4</span>
        </h2>
        <span className="text-xs text-muted-foreground">{filtered.length} kanji</span>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Ordre pédagogique : les kanji <span className="font-medium text-foreground">N5 d&apos;abord</span>, du plus simple
        (1ʳᵉ année d&apos;école primaire) au plus complexe, puis les kanji N4.
      </p>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher : 水, « eau », ミズ, みず…"
            className="pl-9"
            aria-label="Rechercher un kanji"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={level === "all"} onClick={() => setLevel("all")}>
            Tous ({counts.all})
          </FilterChip>
          <FilterChip active={level === "N5"} onClick={() => setLevel("N5")}>
            N5 ({counts.N5})
          </FilterChip>
          <FilterChip active={level === "N4"} onClick={() => setLevel("N4")}>
            N4 ({counts.N4})
          </FilterChip>
        </div>
      </div>

      <div className="custom-scroll max-h-[65vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {filtered.map((k) => {
            const p = progressMap.get(progressKey("kanji", k.id));
            const mastered = p && p.intervalDays >= 21;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setSelected(k)}
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-xl border bg-card p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow",
                  mastered && "border-matcha/50 bg-matcha/5"
                )}
                aria-label={`Kanji ${k.character}, ${k.meaningsFr[0] ?? ""}`}
              >
                <span className="font-jp-serif text-4xl">{k.character}</span>
                <span className="w-full truncate text-center text-[11px] text-muted-foreground">
                  {k.meaningsFr[0] ?? k.meaningsEn[0]}
                </span>
                <span className="flex items-center gap-1">
                  <LevelBadge level={k.level} />
                  {p && (
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", mastered ? "bg-matcha" : "bg-gold")}
                      title={mastered ? "Maîtrisé" : "En apprentissage"}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="font-jp-serif text-5xl">{selected.character}</span>
                  <div className="flex flex-col gap-1">
                    <LevelBadge level={selected.level} className="w-fit" />
                    <span className="text-xs font-normal text-muted-foreground">
                      {selected.strokes} traits
                      {selected.grade >= 1 && selected.grade <= 6
                        ? ` · ${selected.grade}${selected.grade === 1 ? "ʳᵉ" : "ᵉ"} année d\u2019école`
                        : ""}
                    </span>
                  </div>
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Détails du kanji {selected.character}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 rounded-lg bg-secondary/50 p-3">
                  <div>
                    <p className="text-base font-medium">{selected.meaningsFr.join(" ; ")}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{selected.meaningsEn.join(" ; ")}</p>
                  </div>
                  <AudioButton text={selected.character} />
                </div>

                {splitOnyomi(selected.onyomi).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lectures on</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {splitOnyomi(selected.onyomi).map((o) => (
                        <span key={o} className="font-jp rounded-md bg-gold/15 px-2 py-0.5 text-sm text-[#8a6d1d]">
                          {o}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {cleanKunyomi(selected.kunyomi).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lectures kun</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {cleanKunyomi(selected.kunyomi).map((k) => (
                        <span key={k} className="font-jp rounded-md bg-secondary px-2 py-0.5 text-sm">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selected.examples.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Vocabulaire avec ce kanji
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {selected.examples.map((ex) => (
                        <div key={ex.word} className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm">
                              <span className="font-jp font-medium">{ex.word}</span>{" "}
                              <span className="text-muted-foreground">[{ex.reading}]</span>
                            </p>
                            {ex.fr && <p className="truncate text-xs text-muted-foreground">{ex.fr}</p>}
                          </div>
                          <AudioButton text={ex.word} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
