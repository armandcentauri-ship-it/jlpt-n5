/**
 * Corrections ciblées de furigana : lectures irrégulières / contextuelles
 * que kuromoji ne connaît pas. Le CSV (kana) fait foi.
 * Passe finale après scripts/seed-phrases.mjs — idempotent.
 */
import path from "node:path";
import { createClient } from "@libsql/client";

const db = createClient({ url: "file:" + path.resolve(process.cwd(), "db", "custom.db") });

const FIXES = [
  ["phr004", "{二|に}{十|じゅう}{歳|さい}", "{二十歳|はたち}"],
  ["phr009", "{何|なに}", "{何|なん}"],
  ["phr013", "{日本人|にっぽんじん}", "{日本人|にほんじん}"],
  ["phr018", "{何|なに}", "{何|なん}"],
  ["phr028", "{七|なな}{時|じ}", "{七時|しちじ}"],
  ["phr044", "{辛い|つらい}", "{辛い|からい}"],
  ["phr048", "{一|いち}{人|にん}", "{一人|ひとり}"],
  ["phr050", "{十|じゅう}{歳|さい}", "{十歳|じゅっさい}"],
  ["phr052", "{四|よん}{人|にん}", "{四人|よにん}"],
  ["phr055", "{二|に}{人|にん}", "{二人|ふたり}"],
  ["phr063", "{九|きゅう}{時|じ}", "{九時|くじ}"],
  ["phr066", "{日本|にっぽん}", "{日本|にほん}"],
  ["phr075", "{降り|おり}", "{降り|ふり}"],
  ["phr132", "{日本|にっぽん}", "{日本|にほん}"],
];

let applied = 0;
for (const [id, from, to] of FIXES) {
  const cur = await db.execute({ sql: "SELECT furigana FROM Phrase WHERE id = ?", args: [id] });
  if (!cur.rows.length) continue;
  const f = String(cur.rows[0].furigana);
  if (!f.includes(from)) continue; // déjà corrigé ou différent → skip
  await db.execute({ sql: "UPDATE Phrase SET furigana = ? WHERE id = ?", args: [f.replace(from, to), id] });
  applied++;
}
console.log(`✓ ${applied} correction(s) appliquée(s) sur ${FIXES.length}`);
process.exit(0);
