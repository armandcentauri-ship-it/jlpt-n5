/**
 * Contrôle qualité : pour chaque phrase, la lecture reconstruite depuis le
 * furigana (kanji → lecture, reste tel quel) doit correspondre à la colonne
 * kana du CSV. Détecte les lectures irrégulières mal tokenisées.
 */
import path from "node:path";
import { createClient } from "@libsql/client";

const db = createClient({ url: "file:" + path.resolve(process.cwd(), "db", "custom.db") });
const norm = (s) => s.replace(/[。、！？\s\u3000]/g, "");

const rows = (await db.execute("SELECT id, ja, kana, furigana FROM Phrase ORDER BY orderIdx")).rows;
let mismatches = 0;
for (const r of rows) {
  const reading = String(r.furigana).replace(/\{([^|{}]+)\|([^{}]+)\}/g, (_, __, r2) => r2);
  if (norm(reading) !== norm(String(r.kana))) {
    mismatches++;
    console.log(`${r.id}: ${r.ja}`);
    console.log(`   furigana → ${reading}`);
    console.log(`   csv kana → ${r.kana}`);
  }
}
console.log(mismatches ? `\n${mismatches} écart(s) détecté(s)` : "\n✓ Toutes les lectures correspondent au CSV");
process.exit(0);
