import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensurePushTable } from "@/lib/push";

export const dynamic = "force-dynamic";

interface PushSubBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

/** POST /api/push/subscribe — enregistre l'abonnement push de ce navigateur. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PushSubBody;
    const endpoint = body.endpoint;
    const p256dh = body.keys?.p256dh;
    const auth = body.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Abonnement incomplet." }, { status: 400 });
    }

    await ensurePushTable();
    await db.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh, auth },
      update: { p256dh, auth },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/push/subscribe:", err);
    return NextResponse.json({ error: "Erreur d'enregistrement." }, { status: 500 });
  }
}
