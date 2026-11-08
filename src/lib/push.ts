import { sendNotification, setVapidDetails } from "web-push";
import { db } from "@/lib/db";

let tableReady = false;

/** Crée la table PushSubscription si absente (idempotent, une fois par process).
 *  Permet à l'app de s'auto-configurer sur Turso sans migration manuelle. */
export async function ensurePushTable(): Promise<void> {
  if (tableReady) return;
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS PushSubscription (
      id TEXT PRIMARY KEY,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  tableReady = true;
}

/** Clés VAPID configurées côté serveur ? */
export function vapidConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Envoie une notification push à un abonnement.
 *  `gone` = abonnement expiré côté navigateur (404/410) → à supprimer en base. */
export async function sendToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<{ ok: boolean; gone: boolean }> {
  setVapidDetails(
    "mailto:jlpt-n5@example.com",
    process.env.VAPID_PUBLIC_KEY ?? "",
    process.env.VAPID_PRIVATE_KEY ?? ""
  );
  try {
    await sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? "/" }),
      { TTL: 2 * 24 * 3600 } // conserve le message 2 jours si l'appareil est hors ligne
    );
    return { ok: true, gone: false };
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    return { ok: false, gone: statusCode === 404 || statusCode === 410 };
  }
}

/** Nombre de cartes (vocabulaire + kanji) dont la révision est échue. */
export async function countDueCards(): Promise<number> {
  const now = new Date();
  return db.progress.count({
    where: { itemType: { in: ["word", "kanji"] }, dueAt: { lte: now } },
  });
}
