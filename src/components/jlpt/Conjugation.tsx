"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Dices,
  Eye,
  GraduationCap,
  Send,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { progressKey, useAppState, useReview } from "./state";
import { SETTING_KEYS, useLocalBool } from "./settings";
import { SectionTitle, FilterChip, LevelBadge } from "./bits";
import { AudioButton, speakJa } from "./AudioButton";
import { Ruby } from "./Ruby";
import { KanaInput } from "./KanaInput";
import { checkConj } from "@/lib/grade";
import { finalizeKana } from "@/lib/romaji";
import {
  buildVerbList,
  conjRefs,
  conjugateVerb,
  CONJ_FORMS,
  FORM_KEYS,
  GROUP_SHORT,
  N5_FORM_KEYS,
  verbFurigana,
  type ConjGroup,
  type FormKey,
  type VerbItem,
} from "@/lib/conjugation";
import { cn } from "@/lib/utils";

type Phase = "setup" | "session" | "done";
type Status = "answering" | "correct" | "close" | "wrong" | "revealed";
type Mode = "train" | "tables";
type LevelFilter = "N5" | "N4" | "all";
type GroupFilter = "all" | ConjGroup | "irregular";

const MASTERED_DAYS = 21; // cohérent avec le reste de l'app

interface ConjQuestion {
  verb: VerbItem;
  form: FormKey;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const inGroupFilter = (v: VerbItem, g: GroupFilter) =>
  g === "all" ||
  (g === "irregular"
    ? v.group === "suru" || v.group === "kuru" || v.isSpecialIku || v.isSpecialAru
    : v.group === g);

export function Conjugation({ autoStart }: { autoStart?: boolean }) {
  const { words, progressMap } = useAppState();
  /* lecture automatique de la forme conjuguée à la révélation de la réponse */
  const [autoAudio] = useLocalBool(SETTING_KEYS.autoAudio, true);
  const { submit } = useReview();

  const verbs = useMemo(() => buildVerbList(words), [words]);

  const [mode, setMode] = useState<Mode>("train");
  const [phase, setPhase] = useState<Phase>("setup");
  const [level, setLevel] = useState<LevelFilter>("N5");
  const [group, setGroup] = useState<GroupFilter>("all");
  const [forms, setForms] = useState<Set<FormKey>>(() => new Set(N5_FORM_KEYS));
  const [size, setSize] = useState(10);

  const [queue, setQueue] = useState<ConjQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("answering");
  const [tally, setTally] = useState({ correct: 0, total: 0 });

  /* ---------------- pool selon les filtres ---------------- */
  const pool = useMemo(
    () => verbs.filter((v) => (level === "all" || v.level === level) && inGroupFilter(v, group)),
    [verbs, level, group]
  );

  const groupCounts = useMemo(() => {
    const base = verbs.filter((v) => level === "all" || v.level === level);
    return {
      all: base.length,
      godan: base.filter((v) => v.group === "godan" && !v.isSpecialIku && !v.isSpecialAru).length,
      ichidan: base.filter((v) => v.group === "ichidan").length,
      irregular: base.filter((v) => inGroupFilter(v, "irregular")).length,
    };
  }, [verbs, level]);

  /** Paires (verbe, forme) dont la révision SRS est échue, dans les filtres courants. */
  const duePairs = useMemo(() => {
    const now = Date.now();
    const out: ConjQuestion[] = [];
    const poolIds = new Set(pool.map((v) => v.id));
    for (const p of progressMap.values()) {
      if (p.itemType !== "conj" || !p.itemId.includes(":")) continue;
      const sep = p.itemId.lastIndexOf(":");
      const wordId = p.itemId.slice(0, sep);
      const form = p.itemId.slice(sep + 1) as FormKey;
      if (!poolIds.has(wordId) || !forms.has(form)) continue;
      if (new Date(p.dueAt).getTime() <= now) {
        const verb = pool.find((v) => v.id === wordId);
        if (verb) out.push({ verb, form });
      }
    }
    return out;
  }, [progressMap, pool, forms]);

  const mastery = useMemo(() => {
    let total = 0;
    let mastered = 0;
    const sel = [...forms];
    for (const v of pool) {
      for (const f of sel) {
        total++;
        const p = progressMap.get(progressKey("conj", `${v.id}:${f}`));
        if (p && p.intervalDays >= MASTERED_DAYS) mastered++;
      }
    }
    return { total, mastered, pct: total ? mastered / total : 0 };
  }, [pool, forms, progressMap]);

  /* ---------------- session ---------------- */
  const buildQueue = () => {
    const selected = CONJ_FORMS.filter((f) => forms.has(f.key)).map((f) => f.key);
    if (!pool.length || !selected.length) return;
    const maxN = Math.min(size, pool.length * selected.length);
    const seen = new Set<string>();
    const q: ConjQuestion[] = [];

    // d'abord les révisions échues (SRS), puis du neuf / aléatoire
    for (const d of shuffle(duePairs)) {
      if (q.length >= maxN) break;
      const k = `${d.verb.id}:${d.form}`;
      if (!seen.has(k)) {
        seen.add(k);
        q.push(d);
      }
    }
    if (q.length < maxN) {
      const sv = shuffle(pool);
      const sf = shuffle(selected);
      for (let i = 0; q.length < maxN && i < maxN * 8; i++) {
        const verb = sv[i % sv.length];
        const form = sf[(i + Math.floor(i / Math.max(1, sf.length))) % sf.length];
        const k = `${verb.id}:${form}`;
        if (!seen.has(k)) {
          seen.add(k);
          q.push({ verb, form });
        }
      }
    }
    if (!q.length) return;
    setQueue(shuffle(q));
    setIndex(0);
    setInput("");
    setStatus("answering");
    setTally({ correct: 0, total: 0 });
    setPhase("session");
    setMode("train");
  };

  /* Lancement direct depuis le tableau de bord (panneau conjugaison) */
  const started = useRef(false);
  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      buildQueue();
    }
  });

  const finishItem = (wasCorrect: boolean) => {
    const q = queue[index];
    if (!q) return;
    submit("conj", `${q.verb.id}:${q.form}`, wasCorrect ? 2 : 0, "conj");
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
    const q = queue[index];
    if (!q) return;
    const f = conjugateVerb(q.verb)[q.form];
    /* finalise le « n » en attente du clavier kana */
    const { result } = checkConj(finalizeKana(input), conjRefs(f));
    /* audio auto : on prononce la forme conjuguée dès que la réponse est révélée */
    if (autoAudio) speakJa(f.kanji || f.kana);
    setStatus(result === "correct" ? "correct" : result === "close" ? "close" : "wrong");
  };

  const reveal = () => {
    const q = queue[index];
    if (autoAudio && q) {
      const f = conjugateVerb(q.verb)[q.form];
      speakJa(f.kanji || f.kana);
    }
    setStatus("revealed");
  };

  const toggleForm = (key: FormKey) => {
    setForms((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  /* ---------------- rendu ---------------- */
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-10 pt-6">
      <SectionTitle kanji="動詞">Conjugaison</SectionTitle>

      {/* bascule Entraînement / Tableaux */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("train")}
          aria-pressed={mode === "train"}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all",
            mode === "train" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "bg-card hover:border-primary/40"
          )}
        >
          <GraduationCap className="h-4 w-4" aria-hidden /> Entraînement
        </button>
        <button
          type="button"
          onClick={() => setMode("tables")}
          aria-pressed={mode === "tables"}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all",
            mode === "tables" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "bg-card hover:border-primary/40"
          )}
        >
          <BookOpen className="h-4 w-4" aria-hidden /> Tableaux
        </button>
      </div>

      {mode === "train" ? (
        phase === "setup" ? (
          <TrainSetup
            pool={pool}
            groupCounts={groupCounts}
            level={level}
            setLevel={setLevel}
            group={group}
            setGroup={setGroup}
            forms={forms}
            toggleForm={toggleForm}
            setForms={setForms}
            size={size}
            setSize={setSize}
            mastery={mastery}
            nDue={duePairs.length}
            onStart={buildQueue}
          />
        ) : phase === "done" ? (
          <TrainDone
            tally={tally}
            onAgain={buildQueue}
            onSettings={() => setPhase("setup")}
            onTables={() => {
              setMode("tables");
              setPhase("setup");
            }}
          />
        ) : (
          <TrainSession
            queue={queue}
            index={index}
            input={input}
            setInput={setInput}
            status={status}
            check={check}
            reveal={reveal}
            finishItem={finishItem}
            quit={() => setPhase("setup")}
          />
        )
      ) : (
        <Tables />
      )}
    </div>
  );
}

/* ================= sous-vues ================= */

function TrainSetup(props: {
  pool: VerbItem[];
  groupCounts: { all: number; godan: number; ichidan: number; irregular: number };
  level: LevelFilter;
  setLevel: (l: LevelFilter) => void;
  group: GroupFilter;
  setGroup: (g: GroupFilter) => void;
  forms: Set<FormKey>;
  toggleForm: (k: FormKey) => void;
  setForms: (s: Set<FormKey>) => void;
  size: number;
  setSize: (n: number) => void;
  mastery: { total: number; mastered: number; pct: number };
  nDue: number;
  onStart: () => void;
}) {
  const { pool, groupCounts, level, setLevel, group, setGroup, forms, toggleForm, setForms, size, setSize, mastery, nDue, onStart } = props;
  const nPairs = pool.length * forms.size;
  return (
    <Card className="anim-fade-up">
      <CardContent className="space-y-5 p-6">
        {nDue > 0 && (
          <p className="text-sm font-medium text-primary">
            {nDue} forme{nDue > 1 ? "s" : ""} à réviser aujourd&apos;hui
          </p>
        )}

        <div>
          <p className="mb-2 text-sm font-medium">Niveau</p>
          <div className="flex flex-wrap gap-2">
            {(["N5", "N4", "all"] as LevelFilter[]).map((l) => (
              <FilterChip key={l} active={level === l} onClick={() => setLevel(l)}>
                {l === "all" ? "Tous les niveaux" : l}
              </FilterChip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Groupes</p>
          <div className="flex flex-wrap gap-2">
            <FilterChip active={group === "all"} onClick={() => setGroup("all")}>
              Tous ({groupCounts.all})
            </FilterChip>
            <FilterChip active={group === "godan"} onClick={() => setGroup("godan")}>
              <span className="font-jp">五段</span> godan ({groupCounts.godan})
            </FilterChip>
            <FilterChip active={group === "ichidan"} onClick={() => setGroup("ichidan")}>
              <span className="font-jp">一段</span> ichidan ({groupCounts.ichidan})
            </FilterChip>
            <FilterChip active={group === "irregular"} onClick={() => setGroup("irregular")}>
              Irréguliers &amp; する ({groupCounts.irregular})
            </FilterChip>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Formes</p>
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => setForms(new Set(FORM_KEYS))}
              >
                Tout
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => setForms(new Set(["pres", "pol", "past"] as FormKey[]))}
              >
                Bases
              </Button>
            </div>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {CONJ_FORMS.map((f) => {
              const on = forms.has(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggleForm(f.key)}
                  aria-pressed={on}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-all",
                    on ? "border-primary/50 bg-primary/5" : "bg-card text-muted-foreground"
                  )}
                >
                  <span>
                    {f.label}
                    {f.level === "N4" && (
                      <span className="ml-1.5 inline-block rounded border border-gold/40 bg-gold/15 px-1 align-middle text-[10px] font-bold leading-4 text-[#8a6d1d]">
                        N4
                      </span>
                    )}
                    <span className="ml-1.5 font-jp text-xs text-muted-foreground">{f.hint}</span>
                  </span>
                  <span
                    className={cn(
                      "ml-2 h-4 w-4 shrink-0 rounded-full border",
                      on ? "border-primary bg-primary" : "border-border"
                    )}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Questions</p>
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

        {mastery.total > 0 && (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Maîtrisées</span>
              <span>
                {mastery.mastered}/{mastery.total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-matcha transition-all duration-500"
                style={{ width: `${Math.min(100, mastery.pct * 100)}%` }}
              />
            </div>
          </div>
        )}

        <Button onClick={onStart} disabled={!pool.length || !forms.size} className="h-11 w-full rounded-full">
          Commencer {nPairs > 0 && <span className="ml-1 text-xs opacity-80">({nPairs} combinaisons)</span>}
          <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
        </Button>
      </CardContent>
    </Card>
  );
}

function TrainSession(props: {
  queue: ConjQuestion[];
  index: number;
  input: string;
  setInput: (v: string) => void;
  status: Status;
  check: () => void;
  reveal: () => void;
  finishItem: (wasCorrect: boolean) => void;
  quit: () => void;
}) {
  const { queue, index, input, setInput, status, check, reveal, finishItem, quit } = props;
  const q = queue[index];
  if (!q) return null;
  const { verb, form } = q;
  const formDef = CONJ_FORMS.find((f) => f.key === form)!;
  const forms = conjugateVerb(verb);
  const answer = forms[form];
  const answered = status !== "answering";
  const showInput = status === "answering";

  return (
    <div className="space-y-4">
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
        <Button variant="ghost" size="sm" onClick={quit} className="text-muted-foreground">
          Quitter
        </Button>
      </div>

      <Card className="anim-fade-up">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {formDef.label}
              {formDef.level === "N4" && (
                <span className="rounded border border-gold/40 bg-gold/15 px-1 text-[10px] font-bold leading-4 text-[#8a6d1d]">
                  N4
                </span>
              )}
              <span className="font-jp font-normal">{formDef.hint}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {GROUP_SHORT[verb.group]}
              </span>
              <LevelBadge level={verb.level} />
            </span>
          </div>

          <div className="rounded-xl border bg-secondary/30 p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <Ruby text={verbFurigana(verb.word, verb.reading)} className="font-jp text-3xl md:text-4xl" />
                <p className="mt-1.5 text-sm text-muted-foreground">
                  <span className="font-jp">[{verb.reading}]</span> · {verb.meaningFr.split(";")[0]}
                </p>
              </div>
              <AudioButton text={verb.word} size="icon-lg" />
            </div>
          </div>

          <label htmlFor="conj-input" className="text-sm font-medium">
            Écris ce verbe à la forme <span className="text-primary">{formDef.label.toLowerCase()}</span> :
          </label>

          {showInput ? (
            <div className="flex gap-2">
              <KanaInput
                value={input}
                onChange={setInput}
                onSubmit={check}
                autoFocus
                ariaLabel="Réponse conjuguée"
                placeholder="Tape la forme conjuguée…"
              />
              <Button onClick={check} size="lg" className="h-12 rounded-xl px-5 md:h-14" disabled={!input.trim()}>
                <Send className="mr-1 h-4 w-4" aria-hidden /> Vérifier
              </Button>
            </div>
          ) : null}

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
                <p
                  className={cn(
                    "font-semibold",
                    status === "correct" ? "text-matcha" : status === "close" ? "text-[#8a6d1d]" : "text-destructive"
                  )}
                >
                  {status === "correct"
                    ? "正解 ! C'est correct."
                    : status === "close"
                      ? "Presque ! Vérifie la terminaison."
                      : status === "revealed"
                        ? "Réponse révélée."
                        : "Pas tout à fait."}
                </p>
              </div>

              <div className="rounded-lg bg-card/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Réponse attendue · {formDef.label}
                </p>
                <div className="mt-1 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-jp text-2xl">{answer.kanji}</p>
                    <p className="font-jp text-sm text-muted-foreground">{answer.kana}</p>
                    {answer.alts && answer.alts.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Aussi accepté : <span className="font-jp">{answer.alts[0]}</span>
                      </p>
                    )}
                  </div>
                  <AudioButton text={answer.kanji} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {status === "correct" ? (
                  <Button onClick={() => finishItem(true)} className="rounded-full">
                    Continuer <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => finishItem(true)}
                      variant="outline"
                      className="border-matcha/50 text-matcha hover:bg-matcha hover:text-matcha-foreground"
                    >
                      C&apos;était correct
                    </Button>
                    <Button
                      onClick={() => finishItem(false)}
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
                    >
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

function TrainDone(props: {
  tally: { correct: number; total: number };
  onAgain: () => void;
  onSettings: () => void;
  onTables: () => void;
}) {
  const { tally, onAgain, onSettings, onTables } = props;
  const pct = tally.total ? Math.round((tally.correct / tally.total) * 100) : 0;
  return (
    <Card className="anim-pop">
      <CardContent className="space-y-5 p-8 text-center">
        <div
          className={cn(
            "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
            pct >= 80 ? "bg-matcha/15" : pct >= 50 ? "bg-gold/20" : "bg-destructive/10"
          )}
        >
          <span className="font-jp text-2xl font-bold">{pct >= 80 ? "上" : pct >= 50 ? "中" : "初"}</span>
        </div>
        <h2 className="font-jp text-2xl font-bold">
          {pct >= 80 ? "素晴らしい !" : pct >= 50 ? "いいね !" : "練習、練習 !"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {tally.correct} / {tally.total} formes correctes ({pct}%)
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={onAgain} className="rounded-full">
            <Dices className="mr-2 h-4 w-4" aria-hidden /> Encore une série
          </Button>
          <Button variant="outline" onClick={onSettings} className="rounded-full">
            Changer les réglages
          </Button>
          <Button variant="outline" onClick={onTables} className="rounded-full">
            <BookOpen className="mr-2 h-4 w-4" aria-hidden /> Tableaux
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


/* ================= TABLEAUX GLOBAUX ================= */

/** Un verbe d'exemple par groupe — conjugué par le même moteur que l'entraînement. */
const GROUP_EXAMPLES: {
  head: string;
  sub: string;
  verb: Pick<VerbItem, "word" | "reading" | "group" | "isSpecialIku" | "isSpecialAru">;
}[] = [
  {
    head: "Groupe 1",
    sub: "五段 · 書く",
    verb: { word: "書く", reading: "かく", group: "godan", isSpecialIku: false, isSpecialAru: false },
  },
  {
    head: "Groupe 2",
    sub: "一段 · 食べる",
    verb: { word: "食べる", reading: "たべる", group: "ichidan", isSpecialIku: false, isSpecialAru: false },
  },
  {
    head: "Groupe 3",
    sub: "する · 勉強する",
    verb: { word: "勉強する", reading: "べんきょうする", group: "suru", isSpecialIku: false, isSpecialAru: false },
  },
  {
    head: "Groupe 3",
    sub: "irrégulier · 来る",
    verb: { word: "来る", reading: "くる", group: "kuru", isSpecialIku: false, isSpecialAru: false },
  },
];

/** Rappel : formation de la forme en -ta (passé neutre) selon la terminaison. */
interface TaExample {
  vFuri: string;
  taFuri: string;
}
const TA_RULES: { term: string; ta: string; ex: TaExample[]; note?: string }[] = [
  {
    term: "五段 · う つ る",
    ta: "った",
    ex: [
      { vFuri: "{買|か}う", taFuri: "{買|か}った" },
      { vFuri: "{待|ま}つ", taFuri: "{待|ま}った" },
      { vFuri: "{売|う}る", taFuri: "{売|う}った" },
    ],
  },
  {
    term: "五段 · む ぶ ぬ",
    ta: "んだ",
    ex: [
      { vFuri: "{飲|の}む", taFuri: "{飲|の}んだ" },
      { vFuri: "{遊|あそ}ぶ", taFuri: "{遊|あそ}んだ" },
      { vFuri: "{死|し}ぬ", taFuri: "{死|し}んだ" },
    ],
  },
  {
    term: "五段 · く",
    ta: "いた",
    ex: [{ vFuri: "{書|か}く", taFuri: "{書|か}いた" }],
    note: "exception : 行く → 行った",
  },
  {
    term: "五段 · ぐ",
    ta: "いだ",
    ex: [{ vFuri: "{泳|およ}ぐ", taFuri: "{泳|およ}いだ" }],
  },
  {
    term: "五段 · す",
    ta: "した",
    ex: [{ vFuri: "{話|はな}す", taFuri: "{話|はな}した" }],
  },
  {
    term: "一段 · る",
    ta: "た",
    ex: [
      { vFuri: "{食|た}べる", taFuri: "{食|た}べた" },
      { vFuri: "{見|み}る", taFuri: "{見|み}た" },
    ],
  },
  {
    term: "Groupe 3",
    ta: "した・きた",
    ex: [
      { vFuri: "{勉強|べんきょう}する", taFuri: "{勉強|べんきょう}した" },
      { vFuri: "{来|き}る", taFuri: "{来|き}た" },
    ],
  },
];

function Tables() {
  return (
    <div className="space-y-5">
      {/* Tableau 1 — les trois groupes de verbes */}
      <Card className="anim-fade-up">
        <CardContent className="p-5 md:p-6">
          <h3 className="text-base font-bold">
            <span className="font-jp mr-2 text-primary">活用</span>
            Les trois groupes de verbes
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Un verbe d&apos;exemple par groupe · les formes 〜て sont N4
          </p>
          <div className="custom-scroll mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b bg-secondary/50">
                  <th
                    scope="col"
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Forme
                  </th>
                  {GROUP_EXAMPLES.map((g) => (
                    <th key={g.sub} scope="col" className="px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.head}
                      </p>
                      <p className="font-jp text-sm font-bold text-foreground">{g.sub}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {CONJ_FORMS.map((f) => (
                  <tr key={f.key}>
                    <td className="w-32 px-3 py-2 align-top sm:w-40">
                      <p className="text-sm font-medium">
                        {f.label}
                        {f.level === "N4" && (
                          <span className="ml-1.5 inline-block rounded border border-gold/40 bg-gold/15 px-1 align-middle text-[10px] font-bold leading-4 text-[#8a6d1d]">
                            N4
                          </span>
                        )}
                      </p>
                      <p className="font-jp text-[11px] text-muted-foreground">{f.hint}</p>
                    </td>
                    {GROUP_EXAMPLES.map((g) => {
                      const a = conjugateVerb(g.verb)[f.key];
                      return (
                        <td key={g.sub} className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className="min-w-0">
                              <p className="font-jp text-base leading-tight">{a.kanji}</p>
                              {a.kana !== a.kanji && (
                                <p className="font-jp text-[11px] text-muted-foreground">{a.kana}</p>
                              )}
                            </div>
                            <AudioButton text={a.kanji} className="h-7 w-7" />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tableau 2 — rappel : comment former la forme en -ta */}
      <Card className="anim-fade-up">
        <CardContent className="p-5 md:p-6">
          <h3 className="text-base font-bold">
            <span className="font-jp mr-2 text-primary">過去</span>
            La forme en -ta (passé neutre)
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Comment le verbe change selon sa terminaison
          </p>
          <div className="custom-scroll mt-4 overflow-x-auto">
            <table className="w-full min-w-[440px] text-left">
              <thead>
                <tr className="border-b bg-secondary/50">
                  <th
                    scope="col"
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Terminaison
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Devient
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Exemples
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {TA_RULES.map((r) => (
                  <tr key={r.term}>
                    <td className="w-28 px-3 py-2.5 align-top">
                      <span className="font-jp text-sm font-semibold">{r.term}</span>
                    </td>
                    <td className="w-24 px-3 py-2.5 align-top">
                      <span className="font-jp inline-block rounded-md bg-primary/10 px-2 py-0.5 text-sm font-bold text-primary">
                        {r.ta}
                      </span>
                      {r.note && (
                        <p className="mt-1 text-[11px] font-medium text-[#8a6d1d]">{r.note}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="space-y-1">
                        {r.ex.map((e) => (
                          <p key={e.vFuri} className="font-jp text-sm">
                            <Ruby text={e.vFuri} /> <span className="text-muted-foreground">→</span>{" "}
                            <Ruby text={e.taFuri} className="font-semibold" />
                          </p>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 rounded-lg bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground">
            La forme en <span className="font-jp font-semibold text-foreground">-te</span> suit
            exactement la même logique : <span className="font-jp">った → って</span> ·{" "}
            <span className="font-jp">んだ → んで</span> · <span className="font-jp">いた → いて</span> ·{" "}
            <span className="font-jp">いだ → いで</span> · <span className="font-jp">した → して</span> ·{" "}
            <span className="font-jp">た → て</span> (et <span className="font-jp">行く → 行って</span>).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
