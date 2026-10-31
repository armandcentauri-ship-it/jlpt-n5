import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** POST /api/reset — réinitialise toute la progression (profil unique). */
export async function POST() {
  try {
    await db.reviewLog.deleteMany({});
    await db.progress.deleteMany({});
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/reset:", err);
    return NextResponse.json({ error: "Échec de la réinitialisation." }, { status: 500 });
  }
}
