import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseList } from "@/lib/format";
import type { ContentResponse, KanjiExample } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/content — tout le contenu (kanji, mots, phrases, progression, stats globales). */
export async function GET() {
  try {
    const [words, kanji, phrases, progress, logs] = await Promise.all([
      db.word.findMany({ orderBy: { orderIdx: "asc" } }),
      db.kanji.findMany({ orderBy: { orderIdx: "asc" } }),
      db.phrase.findMany({ orderBy: { orderIdx: "asc" } }),
      db.progress.findMany(),
      db.reviewLog.findMany({ select: { grade: true, createdAt: true, mode: true, itemType: true } }),
    ]);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayLogs = logs.filter((l) => l.createdAt >= startOfDay);
    const attempts = logs.filter((l) => l.mode !== "flashcard");
    const stats = {
      attempts: attempts.length,
      correct: attempts.filter((l) => l.grade >= 2).length,
      attemptsToday: todayLogs.length,
      correctToday: todayLogs.filter((l) => l.grade >= 2).length,
      // panneaux « fait aujourd'hui » du tableau de bord
      doneToday: {
        vocab: todayLogs.some((l) => l.itemType === "word" && l.mode === "flashcard"),
        kanji: todayLogs.some((l) => l.itemType === "kanji" && l.mode === "flashcard"),
        phrases: todayLogs.some((l) => l.mode === "ex_jp_fr" || l.mode === "ex_fr_jp"),
        conj: todayLogs.some((l) => l.mode === "conj"),
      },
    };

    const wordsOut = words.map((w) => ({ ...w, pos: parseList(w.pos) as string[] }));
    const kanjiOut = kanji.map((k) => ({
      ...k,
      meaningsFr: parseList(k.meaningsFr),
      meaningsEn: parseList(k.meaningsEn),
      examples: parseList(k.examples) as unknown as KanjiExample[],
    }));

    return NextResponse.json({ words: wordsOut, kanji: kanjiOut, phrases, progress, stats } satisfies ContentResponse);
  } catch (err) {
    console.error("GET /api/content:", err);
    return NextResponse.json({ error: "Impossible de charger le contenu." }, { status: 500 });
  }
}
