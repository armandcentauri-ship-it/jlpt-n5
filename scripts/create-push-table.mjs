/**
 * Crée la table PushSubscription sur la base locale ET sur Turso (prod).
 * Idempotent (CREATE TABLE IF NOT EXISTS).
 *
 * Usage :
 *   node scripts/create-push-table.mjs                     (local uniquement)
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/create-push-table.mjs
 */
import { createClient } from "@libsql/client";

const SQL = `
CREATE TABLE IF NOT EXISTS PushSubscription (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

const targets = [];
if (process.env.TURSO_DATABASE_URL) {
  targets.push({
    name: "Turso (prod)",
    client: createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  });
}
targets.push({ name: "local (db/custom.db)", client: createClient({ url: "file:db/custom.db" }) });

for (const t of targets) {
  await t.client.executeMultiple(SQL);
  const res = await t.client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='PushSubscription'");
  console.log(`${t.name} : table PushSubscription ${res.rows.length ? "présente ✓" : "ABSENTE ✗"}`);
}
