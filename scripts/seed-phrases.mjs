/**
 * Seed des phrases d'entraînement N5 depuis upload/phrases_japonais_N5.csv.
 * - Parse le CSV (UTF-8 BOM, champs quotés, CRLF).
 * - Génère le furigana {kanji|kana} via kuromoji (lecture katakana → hiragana).
 * - Insère avec INSERT OR REPLACE (idempotent, ids fixes phr001…phr150).
 *
 * Usage : node scripts/seed-phrases.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";
import { createClient } from "@libsql/client";

const require = createRequire(import.meta.url);
const kuromoji = require("kuromoji");
const fs = require("node:fs");

const CSV_PATH = fs.existsSync(path.resolve(process.cwd(), "data", "phrases_japonais_N5.csv"))
  ? path.resolve(process.cwd(), "data", "phrases_japonais_N5.csv")
  : path.resolve(process.cwd(), "upload", "phrases_japonais_N5.csv");
const DB_URL = "file:" + path.resolve(process.cwd(), "db", "custom.db");

/* ---------------- CSV (RFC4180) ---------------- */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/* ---------------- Furigana ---------------- */
const KANJI_RE = /[\u4E00-\u9FFF\u3005\u3006]/;
const kataToHira = (s) => s.replace(/[\u30A1-\u30F6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const isAllKana = (s) => /^[\u3040-\u309F\u30A0-\u30FF]+$/.test(s);

function buildFurigana(tokens) {
  let out = "";
  for (const t of tokens) {
    const surface = t.surface_form ?? "";
    const reading = t.reading ? kataToHira(t.reading) : "";
    if (KANJI_RE.test(surface) && reading && isAllKana(reading)) {
      out += `{${surface}|${reading}}`;
    } else {
      out += surface;
    }
  }
  return out;
}

function tokenize(tokenizer, text) {
  return new Promise((resolve, reject) => {
    // tokenizer.tokenize est synchrone, builder est async — déjà construit ici.
    try {
      resolve(tokenizer.tokenize(text));
    } catch (e) {
      reject(e);
    }
  });
}

/* ---------------- Main ---------------- */
const raw = fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
const rows = parseCsv(raw).filter((r) => r.length >= 5 && r[0] !== "id");
console.log(`CSV : ${rows.length} phrases`);

const dicPath = path.dirname(require.resolve("kuromoji/package.json")) + "/dict";
console.log("Chargement du dictionnaire kuromoji…");
kuromoji.builder({ dicPath }).build(async (err, tokenizer) => {
  if (err) {
    console.error("Échec kuromoji :", err);
    process.exit(1);
  }
  console.log("Dictionnaire prêt.");

  const db = createClient({ url: DB_URL });
  const now = new Date().toISOString();
  let ok = 0;
  const warnings = [];

  for (const [idStr, theme, ja, kana, fr] of rows) {
    const num = parseInt(idStr, 10);
    const id = "phr" + String(num).padStart(3, "0");
    let furigana = "";
    try {
      const tokens = await tokenize(tokenizer, ja);
      furigana = buildFurigana(tokens);
      // Cohérence : le furigana "dénudé" doit retomber sur la phrase d'origine
      const stripped = furigana.replace(/\{([^|{}]+)\|[^{}]+\}/g, "$1");
      if (stripped !== ja) warnings.push(`#${num} furigana incohérent : ${furigana}`);
    } catch (e) {
      warnings.push(`#${num} tokenization échouée : ${e.message}`);
    }
    await db.execute({
      sql: `INSERT OR REPLACE INTO Phrase (id, theme, ja, kana, fr, furigana, level, orderIdx, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, 'N5', ?, ?)`,
      args: [id, theme, ja, kana, fr, furigana, num, now],
    });
    ok++;
  }

  console.log(`✓ ${ok} phrases insérées`);
  if (warnings.length) {
    console.log(`⚠ ${warnings.length} avertissement(s) :`);
    for (const w of warnings) console.log("  " + w);
  }

  // Contrôles
  const count = await db.execute("SELECT COUNT(*) n FROM Phrase");
  console.log("Total Phrase :", count.rows[0].n);
  const samples = await db.execute(
    "SELECT id, ja, furigana FROM Phrase WHERE id IN ('phr004','phr076','phr050','phr057','phr032') ORDER BY id"
  );
  for (const r of samples.rows) console.log(`${r.id}: ${r.ja}  →  ${r.furigana}`);
  process.exit(0);
});
