/**
 * Migration one-shot : copie la base SQLite locale (db/custom.db) vers Turso.
 *
 * Usage :
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="eyJ..." npm run db:to-turso
 * (PowerShell : $env:TURSO_DATABASE_URL="..."; $env:TURSO_AUTH_TOKEN="..."; npm run db:to-turso)
 *
 * ⚠️  Écrase les tables Kanji / Word / Progress / ReviewLog de la base distante
 *     avec les données locales. Relançable sans risque (recrée à l'identique).
 */
import path from "node:path";
import { createClient } from "@libsql/client";

const remoteUrl = process.env.TURSO_DATABASE_URL;
const remoteToken = process.env.TURSO_AUTH_TOKEN;

if (!remoteUrl || !remoteUrl.startsWith("libsql://")) {
  console.error("❌ TURSO_DATABASE_URL manquant ou invalide (doit commencer par libsql://).");
  console.error('   Ex. : TURSO_DATABASE_URL="libsql://jlpt-n5-xxx.turso.io" TURSO_AUTH_TOKEN="eyJ..." npm run db:to-turso');
  process.exit(1);
}
if (!remoteToken) {
  console.error("❌ TURSO_AUTH_TOKEN manquant (turso db tokens create <nom-de-la-base>).");
  process.exit(1);
}

const srcPath = path.resolve(process.cwd(), "db", "custom.db");
const src = createClient({ url: "file:" + srcPath });
const dst = createClient({ url: remoteUrl, authToken: remoteToken });

console.log("→ Source :", srcPath);
console.log("→ Cible  :", remoteUrl);

// 1. Schéma : tables + index, à l'identique de la source.
const objects = await src.execute(
  "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'"
);
const tables = objects.rows.filter((r) => r.type === "table");
const indexes = objects.rows.filter((r) => r.type === "index");

for (const t of tables) {
  await dst.execute(`DROP TABLE IF EXISTS "${t.name}"`);
  await dst.execute(String(t.sql));
}
for (const i of indexes) {
  await dst.execute(String(i.sql));
}

// 2. Données : INSERT par lots.
for (const t of tables) {
  const name = t.name;
  const res = await src.execute(`SELECT * FROM "${name}"`);
  const cols = res.columns;
  if (!cols.length) {
    console.log(`✓ ${name}: (vide)`);
    continue;
  }
  const collist = cols.map((c) => `"${c}"`).join(", ");
  const placeholders = cols.map(() => "?").join(", ");
  const stmts = res.rows.map((row) => ({
    sql: `INSERT OR REPLACE INTO "${name}" (${collist}) VALUES (${placeholders})`,
    args: cols.map((c) => row[c] ?? null),
  }));
  for (let i = 0; i < stmts.length; i += 80) {
    await dst.batch(stmts.slice(i, i + 80), "write");
  }
  console.log(`✓ ${name}: ${stmts.length} lignes copiées`);
}

// 3. Vérification.
let ok = true;
for (const t of tables) {
  const a = await src.execute(`SELECT COUNT(*) AS n FROM "${t.name}"`);
  const b = await dst.execute(`SELECT COUNT(*) AS n FROM "${t.name}"`);
  const match = a.rows[0].n === b.rows[0].n;
  if (!match) ok = false;
  console.log(`${match ? "✓" : "✗"} ${t.name}: source=${a.rows[0].n} cible=${b.rows[0].n}`);
}

if (!ok) {
  console.error("❌ Écart détecté entre source et cible — relance le script.");
  process.exit(1);
}
console.log("🎉 Migration terminée : la base Turso est prête pour Vercel.");
