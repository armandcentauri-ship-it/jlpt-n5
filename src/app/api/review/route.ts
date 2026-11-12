import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applySm2 } from "@/lib/srs";
import { FORM_KEYS } from "@/lib/conjugation";
import type { Grade, ReviewMode } from "@/lib/types";

export const dynamic = "force-dynamic";

const MODES: ReviewMode[] = ["flashcard", "ex_jp_fr", "ex_fr_jp", "conj"];

/** POST /api/review — enregistre une révision (SM-2) + journal. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      itemType?: string;
      itemId?: string;
      grade?: number;
      mode?: string;
    };

    const itemType =
      body.itemType === "kanji" ? "kanji"
      : body.itemType === "conj" ? "conj"
      : body.itemType === "phrase" ? "phrase"
      : "word";
    const mode = MODES.includes(body.mode as ReviewMode) ? (body.mode as ReviewMode) : "flashcard";
    const grade = Number(body.grade);
    const itemId = body.itemId;

    if (!itemId || !Number.isInteger(grade) || grade < 0 || grade > 3) {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    // Vérifie que l'item existe
    let exists: boolean;
    if (itemType === "kanji") {
      exists = !!(await db.kanji.findUnique({ where: { id: itemId }, select: { id: true } }));
    } else if (itemType === "conj") {
      // itemId = `${wordId}:${formKey}` — vérifie le mot et la forme
      const sep = itemId.lastIndexOf(":");
      const wordId = sep > 0 ? itemId.slice(0, sep) : "";
      const formKey = sep > 0 ? itemId.slice(sep + 1) : "";
      exists =
        (FORM_KEYS as string[]).includes(formKey) &&
        !!(await db.word.findUnique({ where: { id: wordId }, select: { id: true } }));
    } else if (itemType === "phrase") {
      exists = !!(await db.phrase.findUnique({ where: { id: itemId }, select: { id: true } }));
    } else {
      exists = !!(await db.word.findUnique({ where: { id: itemId }, select: { id: true } }));
    }
    if (!exists) {
      return NextResponse.json({ error: "Item introuvable." }, { status: 404 });
    }

    const prev = await db.progress.findUnique({
      where: { itemType_itemId: { itemType, itemId } },
    });

    const now = new Date();
    const next = applySm2(prev, grade as Grade, now, mode, itemType);

    const saved = await db.progress.upsert({
      where: { itemType_itemId: { itemType, itemId } },
      create: {
        itemType,
        itemId,
        ease: next.ease,
        intervalDays: next.intervalDays,
        reps: next.reps,
        lapses: next.lapses,
        dueAt: next.dueAt,
        lastReviewedAt: next.lastReviewedAt,
      },
      update: {
        ease: next.ease,
        intervalDays: next.intervalDays,
        reps: next.reps,
        lapses: next.lapses,
        dueAt: next.dueAt,
        lastReviewedAt: next.lastReviewedAt,
      },
    });

    await db.reviewLog.create({
      data: { itemType, itemId, mode, grade },
    });

    return NextResponse.json({ progress: saved });
  } catch (err) {
    console.error("POST /api/review:", err);
    return NextResponse.json({ error: "Erreur d'enregistrement." }, { status: 500 });
  }
}
