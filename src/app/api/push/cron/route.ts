import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { countDueCards, ensurePushTable, sendToSubscription, vapidConfigured } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Requête autorisée si CRON_SECRET n'est pas défini (développement local),
 *  ou si l'appel provient du cron Vercel (header Authorization: Bearer <secret>)
 *  ou contient ?secret=<secret> (déclenchement manuel). */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

async function run() {
  if (!vapidConfigured()) {
    return NextResponse.json({ error: "Clés VAPID non configurées sur le serveur." }, { status: 503 });
  }
  await ensurePushTable();

  const due = await countDueCards();
  if (due === 0) {
    return NextResponse.json({ skipped: true, reason: "Aucune carte à réviser.", due: 0, sent: 0 });
  }

  const subs = await db.pushSubscription.findMany();
  const body =
    due === 1
      ? "🌸 1 carte t'attend aujourd'hui. Ouvre l'app pour la réviser !"
      : `🌸 ${due} cartes t'attendent aujourd'hui. Ouvre l'app pour les réviser !`;

  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  for (const sub of subs) {
    const r = await sendToSubscription(sub, { title: "日本語 N5 — révision", body, url: "/" });
    if (r.ok) sent++;
    else {
      failed++;
      if (r.gone) gone.push(sub.endpoint);
    }
  }
  if (gone.length) {
    await db.pushSubscription.deleteMany({ where: { endpoint: { in: gone } } });
  }

  return NextResponse.json({ skipped: false, due, subscribers: subs.length, sent, failed, removed: gone.length });
}

/** GET : déclenché par le cron Vercel (une fois par jour, voir vercel.json). */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    return await run();
  } catch (err) {
    console.error("GET /api/push/cron:", err);
    return NextResponse.json({ error: "Erreur d'envoi." }, { status: 500 });
  }
}

/** POST : déclenchement manuel (test) avec le même secret. */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    return await run();
  } catch (err) {
    console.error("POST /api/push/cron:", err);
    return NextResponse.json({ error: "Erreur d'envoi." }, { status: 500 });
  }
}
