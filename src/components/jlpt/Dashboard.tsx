"use client";

import React, { useMemo } from "react";
import { Check, Trash2 } from "lucide-react";
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
import { useAppState } from "./state";
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
  const { stats } = useAppState();
  const { toast } = useToast();

  /* alternance quotidienne : jour impair = vocabulaire + conjugaison, pair = kanji + phrases */
  const today = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const doy = Math.floor((now.getTime() - start.getTime()) / 86400000);
    return (doy % 2 === 1 ? ["vocab", "conj"] : ["kanji", "phrases"]) as Domain[];
  }, []);

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
              aria-label={`${p.title}${done ? " — fait aujourd'hui" : ""}`}
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

              {/* pastille fait / pas fait */}
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
                ) : (
                  <span
                    aria-hidden
                    className={cn("h-8 w-8 rounded-full border-[2.5px]", inProgram ? "border-white/70" : p.ringCls)}
                  />
                )}
              </span>

              <span className="relative">
                <span className={cn("font-jp block text-2xl font-bold leading-tight md:text-3xl", !inProgram && "opacity-90")}>
                  {p.jp}
                </span>
                <span className="mt-1 block text-base font-bold md:text-lg">{p.title}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* réinitialisation — discret */}
      <div className="mt-8 flex justify-center">
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
