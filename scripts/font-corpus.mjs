/**
 * Génère le corpus de caractères pour le subset des fonts (scripts/build-fonts.sh) :
 * tous les caractères du code UI (src/) + tout le contenu de la DB.
 * Sortie sur stdout (un flux de caractères uniques).
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@libsql/client");

const chars = new Set();

/* 1. Sources UI */
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|css|mjs)$/.test(e.name)) {
      const text = fs.readFileSync(p, "utf8");
      for (const c of text) if (c.codePointAt(0) > 0x1f) chars.add(c); // sans ASCII de contrôle
    }
  }
}
walk(path.resolve(process.cwd(), "src"));

/* 2. Contenu DB */
const db = createClient({ url: "file:" + path.resolve(process.cwd(), "db", "custom.db") });
const tables = ["Word", "Kanji", "Phrase"];
for (const t of tables) {
  const res = await db.execute(`SELECT * FROM "${t}"`);
  for (const row of res.rows) {
    for (const v of Object.values(row)) {
      if (typeof v === "string") for (const c of v) if (c.codePointAt(0) > 0x1f) chars.add(c);
      if (typeof v === "object" && v !== null) {
        for (const s of v) if (typeof s === "string") for (const c of s) chars.add(c);
      }
    }
  }
}

/* Kana, ponctuation CJK et symboles courants, toujours inclus */
const extra =
  "ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめももゃやゅゆょよらりるれろゎわゐゑをんゔ" +
  "ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ" +
  "。、！？「」『』〜〜ー・々ゝゞ（）【】：；" +
  "上中初日今単語漢字動詞文章翻訳残念頑張素晴一期一会正解しっ";
for (const c of extra) chars.add(c);

process.stdout.write([...chars].sort().join(""));
