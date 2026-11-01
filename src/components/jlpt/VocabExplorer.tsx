"use client";

import React, { useCallback, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAppState, progressKey } from "./state";
import { FilterChip, LevelBadge } from "./bits";
import { AudioButton } from "./AudioButton";
import { Ruby } from "./Ruby";
import { splitMeanings } from "@/lib/format";
import { normalizeFr } from "@/lib/grade";
import { themeLabel, THEMES } from "@/lib/themes";
import { dueLabel } from "@/lib/srs";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "new" | "learning" | "mastered" | "N5" | "N4";

const MASTERED_DAYS = 21;

export function VocabExplorer() {
  const { words, progressMap } = useAppState();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [theme, setTheme] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const statusOf = useCallback(
    (wid: string) => {
      const p = progressMap.get(progressKey("word", wid));
      if (!p) return "new" as const;
      return p.intervalDays >= MASTERED_DAYS ? ("mastered" as const) : ("learning" as const);
    },
    [progressMap]
  );

  const themeCounts = useMemo(() => {
    const c = new Map<string, number>();
    for (const w of words) c.set(w.theme, (c.get(w.theme) ?? 0) + 1);
    return c;
  }, [words]);

  const filtered = useMemo(() => {
    const q = normalizeFr(query.trim().toLowerCase());
    return words.filter((w) => {
      if (theme !== "all" && w.theme !== theme) return false;
      const st = statusOf(w.id);
      if (filter === "new" && st !== "new") return false;
      if (filter === "learning" && st !== "learning") return false;
      if (filter === "mastered" && st !== "mastered") return false;
      if ((filter === "N5" || filter === "N4") && w.level !== filter) return false;
      if (!q) return true;
      return (
        w.word.includes(query) ||
        w.reading.includes(query) ||
        w.romaji.toLowerCase().includes(q) ||
        normalizeFr(w.meaningFr).includes(q) ||
        w.meaningEn.toLowerCase().includes(q) ||
        normalizeFr(w.exFr).includes(q) ||
        themeLabel(w.theme).toLowerCase().includes(q)
      );
    });
  }, [words, filter, theme, query, statusOf]);

  /* liste avec en-têtes de thème (les mots sont déjà dans l'ordre pédagogique) */
  const grouped = useMemo(() => {
    const out: ({ type: "header"; label: string; count: number; key: string } | { type: "word"; word: (typeof words)[number] })[] = [];
    let last = "";
    for (const w of filtered) {
      if (w.theme !== last) {
        last = w.theme;
        out.push({ type: "header", label: themeLabel(w.theme), count: themeCounts.get(w.theme) ?? 0, key: w.theme });
      }
      out.push({ type: "word", word: w });
    }
    return out;
  }, [filtered, themeCounts]);

  const counts = useMemo(() => {
    let n = 0, l = 0, m = 0;
    for (const w of words) {
      const st = statusOf(w.id);
      if (st === "new") n++;
      else if (st === "learning") l++;
      else m++;
    }
    return { new: n, learning: l, mastered: m };
  }, [words, statusOf]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-10 pt-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-jp text-2xl font-bold">
          単語 <span className="text-lg text-muted-foreground">· Vocabulaire par thème</span>
        </h2>
        <span className="text-xs text-muted-foreground">{filtered.length} mot(s)</span>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher : 食べる, taberu, « manger »…"
            className="pl-9"
            aria-label="Rechercher un mot"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            Tous ({words.length})
          </FilterChip>
          <FilterChip active={filter === "N5"} onClick={() => setFilter("N5")}>
            N5
          </FilterChip>
          <FilterChip active={filter === "N4"} onClick={() => setFilter("N4")}>
            N4
          </FilterChip>
          <FilterChip active={filter === "new"} onClick={() => setFilter("new")}>
            Nouveaux ({counts.new})
          </FilterChip>
          <FilterChip active={filter === "learning"} onClick={() => setFilter("learning")}>
            En cours ({counts.learning})
          </FilterChip>
          <FilterChip active={filter === "mastered"} onClick={() => setFilter("mastered")}>
            Maîtrisés ({counts.mastered})
          </FilterChip>
        </div>
        <div>
          <label htmlFor="theme-select" className="sr-only">
            Filtrer par thème
          </label>
          <select
            id="theme-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="h-9 w-full max-w-xs rounded-md border border-input bg-card px-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">Tous les thèmes (ordre pédagogique)</option>
            {THEMES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label} ({themeCounts.get(t.key) ?? 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="custom-scroll max-h-[65vh] space-y-2 overflow-y-auto pr-1">
        {grouped.map((g) => {
          if (g.type === "header") {
            return (
              <div key={`h-${g.key}`} className="mt-5 flex items-center gap-2 first:mt-1">
                <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-primary">
                  {g.label}
                </span>
                <span className="h-px flex-1 bg-border" aria-hidden />
                <span className="text-[10px] text-muted-foreground">{g.count}</span>
              </div>
            );
          }
          const w = g.word;
          const st = statusOf(w.id);
          const isOpen = expanded.has(w.id);
          const p = progressMap.get(progressKey("word", w.id));
          const meanings = splitMeanings(w.meaningFr || w.meaningEn);
          return (
            <div
              key={w.id}
              className={cn(
                "rounded-xl border bg-card shadow-sm transition-colors",
                st === "mastered" && "border-matcha/40",
                isOpen && "border-primary/40"
              )}
            >
              <button
                type="button"
                onClick={() => toggle(w.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="font-jp shrink-0 text-xl">{w.word}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      <span className="font-jp text-primary">{w.reading}</span>
                      <span className="mx-1.5 text-border">|</span>
                      <span className="text-muted-foreground">{meanings[0]}</span>
                      {meanings.length > 1 && <span className="text-muted-foreground"> …</span>}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {st === "mastered" && <span className="text-xs text-matcha">✓</span>}
                  {st === "learning" && p && (
                    <span className="hidden text-[10px] text-muted-foreground sm:inline">{dueLabel(p.dueAt)}</span>
                  )}
                  <LevelBadge level={w.level} />
                  <ChevronDown
                    className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                    aria-hidden
                  />
                </span>
              </button>

              {isOpen && (
                <div className="anim-fade-up space-y-3 border-t px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{meanings.join(" ; ")}</p>
                      {w.meaningFr && w.meaningEn && (
                        <p className="mt-0.5 text-xs text-muted-foreground">EN : {w.meaningEn}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {w.romaji && <span className="italic">{w.romaji} · </span>}
                        <span className="font-medium text-primary/80">{themeLabel(w.theme)}</span>
                        {" · "}
                        {w.level === "N5" ? "Vocabulaire N5" : "Complément N4 (type Tango N5)"}
                      </p>
                    </div>
                    <AudioButton text={w.word} />
                  </div>

                  {w.exJa && (
                    <div className="rounded-lg border bg-secondary/30 p-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          {w.exFurigana ? (
                            <Ruby text={w.exFurigana} className="font-jp text-base" />
                          ) : (
                            <p className="font-jp text-base">{w.exJa}</p>
                          )}
                          {w.exFr && <p className="mt-1.5 text-sm italic text-muted-foreground">{w.exFr}</p>}
                        </div>
                        <AudioButton text={w.exJa} />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>
                      {st === "new"
                        ? "Jamais étudié"
                        : p
                          ? `Révision ${dueLabel(p.dueAt)} · intervalle ${Math.round(p.intervalDays)} j · facilité ${p.ease.toFixed(1)}`
                          : ""}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">Aucun résultat pour cette recherche.</p>
        )}
      </div>
    </div>
  );
}
