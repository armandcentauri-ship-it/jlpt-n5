import { NextResponse } from "next/server";
import { vapidConfigured } from "@/lib/push";

/** GET /api/push/config — clé publique VAPID pour le navigateur (null si non configuré). */
export function GET() {
  return NextResponse.json({
    publicKey: vapidConfigured() ? process.env.VAPID_PUBLIC_KEY : null,
  });
}
