import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensurePushTable } from "@/lib/push";

export const dynamic = "force-dynamic";

/** POST /api/push/unsubscribe — retire l'abonnement push de ce navigateur. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { endpoint?: string };
    if (!body.endpoint) {
      return NextResponse.json({ error: "Endpoint manquant." }, { status: 400 });
    }
    await ensurePushTable();
    await db.pushSubscription.deleteMany({ where: { endpoint: body.endpoint } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/push/unsubscribe:", err);
    return NextResponse.json({ error: "Erreur de suppression." }, { status: 500 });
  }
}
