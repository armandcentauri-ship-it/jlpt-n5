import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseList } from "@/lib/format";
import type { ContentResponse, KanjiExample } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/content — tout le contenu (kanji, mots, progression, stats globales). */
export async function GET() {
  try {
    const [words, kanji, progress, logs] = await Promise.all([
      db.word.findMany({ orderBy: { wid: "asc" } }),
      db.kanji.findMany({ orderBy: { level: "desc" } }),
      db.progress.findMany(),
      db.reviewLog.findMany({ select: { grade: true, createdAt: true, mode: true } }),
    ]);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const attempts = logs.filter((l) => l.mode !== "flashcard");
    const stats = {
      attempts: attempts.length,
      correct: attempts.filter((l) => l.grade >= 2).length,
      attemptsToday: logs.filter((l) => l.createdAt >= startOfDay).length,
      correctToday: logs.filter((l) => l.createdAt >= startOfDay && l.grade >= 2).length,
    };

    const wordsOut = words.map((w) => ({ ...w, pos: parseList(w.pos) as string[] }));
    const kanjiOut = kanji.map((k) => ({
      ...k,
      meaningsFr: parseList(k.meaningsFr),
      meaningsEn: parseList(k.meaningsEn),
      examples: parseList(k.examples) as unknown as KanjiExample[],
    }));

    return NextResponse.json({ words: wordsOut, kanji: kanjiOut, progress, stats } satisfies ContentResponse);
  } catch (err) {
    console.error("GET /api/content:", err);
    return NextResponse.json({ error: "Impossible de charger le contenu." }, { status: 500 });
  }
}
