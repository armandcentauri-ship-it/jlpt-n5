// Retire les « jours du mois » (一日〜二十日) de la base locale et/ou Turso,
// ainsi que leur progression (Progress) — sans toucher à l'historique ReviewLog.
// Usage :
//   node scripts/remove-jours-mois.mjs local
//   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/remove-jours-mois.mjs turso
import { createClient } from "@libsql/client";

const JOURS = ["一日", "二日", "三日", "四日", "五日", "六日", "七日", "八日", "九日", "十日", "二十日"];
const mode = process.argv[2] ?? "local";

const url = mode === "turso" ? process.env.TURSO_DATABASE_URL : "file:./db/custom.db";
const authToken = mode === "turso" ? process.env.TURSO_AUTH_TOKEN : undefined;
if (!url) {
  console.error("URL de base manquante (TURSO_DATABASE_URL ?)");
  process.exit(1);
}

const db = createClient({ url, authToken });
const placeholders = JOURS.map(() => "?").join(",");

const before = await db.execute("SELECT COUNT(*) AS n FROM Word");
const found = await db.execute({
  sql: `SELECT id, word, reading FROM Word WHERE theme = 'temps' AND word IN (${placeholders})`,
  args: JOURS,
});
const ids = found.rows.map((r) => r.id);
console.log(`[${mode}] mots trouvés : ${ids.length}/${JOURS.length}`);
for (const r of found.rows) console.log(`  - ${r.word} (${r.reading})`);

if (ids.length) {
  const ph = ids.map(() => "?").join(",");
  const prog = await db.execute({
    sql: `DELETE FROM Progress WHERE itemType = 'word' AND itemId IN (${ph})`,
    args: ids,
  });
  console.log(`[${mode}] progression supprimée : ${prog.rowsAffected} ligne(s)`);
  const del = await db.execute({
    sql: `DELETE FROM Word WHERE id IN (${ph})`,
    args: ids,
  });
  console.log(`[${mode}] mots supprimés : ${del.rowsAffected}`);
}

const after = await db.execute("SELECT COUNT(*) AS n FROM Word");
const progCount = await db.execute("SELECT COUNT(*) AS n FROM Progress");
console.log(`[${mode}] Word : ${before.rows[0].n} → ${after.rows[0].n} | Progress : ${progCount.rows[0].n}`);
