#!/usr/bin/env node
/* Fusion finale des métadonnées pédagogiques dans data/*.json :
 *  1. mots : theme + orderIdx (thème → fundamentalité → simplicité orthographique)
 *  2. mots : exTier (1 = phrase très facile, 2 = plus riche) pour les phrases "simple"
 *  3. kanji : grade (KANJIDIC2, année d'école) + orderIdx (N5 d'abord, puis grade, puis traits)
 * Idempotent, sans LLM.
 */
import fs from 'fs';

const DATA = '/home/z/my-project/data';
const load = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const THEMES = [
  ['base', 'Bases & pronoms'],
  ['politesse', 'Salutations & politesse'],
  ['famille', 'Personnes & famille'],
  ['nombres', 'Nombres & quantité'],
  ['temps', 'Temps, jours & dates'],
  ['position', 'Position & direction'],
  ['maison', 'Maison & objets'],
  ['nourriture', 'Nourriture & boissons'],
  ['lieux', 'Lieux & ville'],
  ['transport', 'Voyage & transport'],
  ['ecole', 'École & études'],
  ['travail', 'Travail & société'],
  ['corps', 'Corps & santé'],
  ['nature', 'Nature & météo'],
  ['animaux', 'Animaux'],
  ['couleurs', 'Couleurs & formes'],
  ['loisirs', 'Loisirs & médias'],
  ['verbes_base', 'Verbes essentiels'],
  ['verbes_vie', 'Verbes du quotidien'],
  ['verbes_mvt', 'Verbes de mouvement'],
  ['verbes_comm', 'Verbes de communication'],
  ['adjectifs', 'Adjectifs & description'],
  ['adverbes', 'Adverbes & fréquence'],
  ['connecteurs', 'Connecteurs & grammaire'],
  ['divers', 'Mots abstraits & divers'],
];
const THEME_KEYS = THEMES.map(([k]) => k);

// Corrections manuelles des cas limites (wid → thème)
const OVERRIDE = {
  61: 'adverbes', 100: 'travail', 130: 'travail', 143: 'verbes_vie', 185: 'maison',
  218: 'travail', 222: 'famille', 249: 'verbes_vie', 285: 'verbes_vie', 286: 'maison',
  327: 'maison', 396: 'maison', 398: 'maison', 449: 'verbes_vie', 537: 'lieux',
  557: 'ecole', 562: 'adverbes', 571: 'adverbes', 586: 'maison', 619: 'maison',
  621: 'ecole', 626: 'temps', 688: 'couleurs', 703: 'ecole', 707: 'ecole',
  712: 'couleurs', 726: 'nature', 730: 'adjectifs', 755: 'ecole', 763: 'verbes_comm',
  794: 'ecole', 820: 'lieux', 830: 'travail', 835: 'loisirs', 841: 'lieux',
  856: 'temps', 857: 'temps', 869: 'temps', 874: 'travail', 882: 'adverbes',
  891: 'temps', 893: 'famille', 898: 'loisirs', 906: 'travail', 955: 'travail',
  967: 'maison', 969: 'verbes_vie', 970: 'verbes_vie', 1001: 'ecole', 1008: 'ecole',
  1016: 'nourriture', 1038: 'nombres', 1042: 'ecole', 1047: 'nombres',
};

// mots de position à replacer (repérés dans base/divers par lecture)
const POSITION_READINGS = new Set(['うえ', 'した', 'なか', 'まえ', 'うしろ', 'みぎ', 'ひだり', 'となり', 'あいだ', 'ちかく', 'きた', 'みなみ', 'ひがし', 'にし', 'むこう', 'そば', 'てまえ', 'おく']);

const words = load(`${DATA}/words.json`);
const meta = load(`${DATA}/llm_meta.json`);
const kanji = load(`${DATA}/kanji.json`);
const grades = load(`${DATA}/src/kanjidic2_grade.json`);

for (const w of words) {
  if (POSITION_READINGS.has(w.reading) && meta[w.wid] && meta[w.wid].t !== 'position' && !OVERRIDE[w.wid]) {
    OVERRIDE[w.wid] = 'position';
  }
}

/* ---------- 1 + 2. mots : thème, ordre, exTier ---------- */
const KANJI_RE = /[\u4e00-\u9faf\u3005\u3006\u30f6\u30fbー々]/;
const n5Set = new Set(kanji.filter((k) => k.level === 'N5').map((k) => k.character));
const allKanjiSet = new Set(kanji.map((k) => k.character));

// motifs de grammaire au-delà du N5 pur (passif, causatif, conditionnel, citation…)
const HARD_PATTERNS = [
  'たら', 'れば', 'ければ', 'なら', 'でしょう', 'だろう', 'かもしれない', 'と思',
  'なければ', 'なくても', 'なくては', 'なきゃ', 'たこと', 'たり', 'ように',
  'ような', 'はず', 'と言', 'と聞', 'てもら', 'てあげ', 'てくれ', 'させて',
  'られる', 'されている', 'について', 'によっ', 'に対し', '間に', 'うちに',
  'ばかり', 'のに', 'すぎる', 'てもいい', 'てはいけ', 'ずに',
  'なさい', 'ないで', 'ちゃっ', 'じゃっ', 'ながら', 'として', 'ために',
  'ばあい', 'けど', 'ので', 'ましょうか', 'ていく', 'てしま', 'しまっ',
];
const HARD_RE = new RegExp(HARD_PATTERNS.filter((p) => !p.includes(' ')).join('|'));

const isExEligible = (w) => w.exDif === 'simple' && w.exJa && w.exFr && w.exKana;

function tierOf(w) {
  if (!isExEligible(w)) return 2;
  const ja = w.exJa;
  const bare = ja.replace(/[\s.、。！？!?,]/g, '');
  const kana = (w.exKana && w.exKana.length ? w.exKana : ja).replace(/[\s.、。！？!?,]/g, '');
  if (bare.length > 16) return 2; // longueur
  for (const ch of ja) if (KANJI_RE.test(ch) && !allKanjiSet.has(ch)) return 2; // kanji non enseigné
  if (HARD_RE.test(kana) || HARD_RE.test(ja)) return 2; // grammaire N4+
  return 1;
}

// groupement pour l'ordre intra-thème
const byKey = new Map();
for (const w of words) {
  const m = meta[w.wid];
  let t = m && THEME_KEYS.includes(m.t) ? m.t : 'divers';
  if (OVERRIDE[w.wid]) t = OVERRIDE[w.wid];
  const n = m ? Math.max(1, Math.min(5, m.n || 3)) : 3;
  const kcount = [...w.word].filter((c) => KANJI_RE.test(c)).length;
  const key = `${t}|${n}`;
  if (!byKey.has(key)) byKey.set(key, []);
  byKey.get(key).push({ w, kcount });
}
const orderIdx = {};
const themeOf = {};
for (const [ti, [tKey]] of THEMES.entries()) {
  for (let n = 1; n <= 5; n++) {
    const group = byKey.get(`${tKey}|${n}`) || [];
    group.sort((a, b) => a.kcount - b.kcount || a.w.word.length - b.w.word.length || a.w.wid - b.w.wid);
    group.forEach(({ w }, rank) => {
      orderIdx[w.wid] = ti * 100000 + n * 20000 + rank;
      themeOf[w.wid] = tKey;
    });
  }
}
for (const w of words) {
  w.theme = themeOf[w.wid] || 'divers';
  w.orderIdx = orderIdx[w.wid] ?? 999999;
  w.exTier = tierOf(w);
}

/* ---------- 3. kanji : grade + ordre ---------- */
for (const k of kanji) {
  const g = grades[k.character] || {};
  const grade = g.grade || 9;
  k.grade = grade;
  const levelPart = k.level === 'N5' ? 0 : 100000;
  k.orderIdx = levelPart + grade * 10000 + (k.strokes || 15) * 50 + Math.min(g.freq || 999, 49);
}
kanji.sort((a, b) => a.orderIdx - b.orderIdx);

/* ---------- écriture + stats ---------- */
fs.writeFileSync(`${DATA}/words.json`, JSON.stringify(words, null, 1));
fs.writeFileSync(`${DATA}/kanji.json`, JSON.stringify(kanji, null, 1));

const cnt = {};
for (const w of words) cnt[w.theme] = (cnt[w.theme] || 0) + 1;
console.log('Thèmes (ordre d\'apprentissage) :');
for (const [k, l] of THEMES) console.log(`  ${String(cnt[k] || 0).padStart(4)}  ${k.padEnd(14)} ${l}`);

const t1 = words.filter((w) => w.exTier === 1 && isExEligible(w));
const t2 = words.filter((w) => w.exTier === 2 && isExEligible(w));
console.log(`\nPhrases d'exercice : ${t1.length} faciles / ${t2.length} plus riches / ${words.filter((w) => !isExEligible(w)).length} exclues`);
console.log('\n— Échantillon NIVEAU 1 :');
for (const w of t1.slice(0, 12)) console.log(`   ${w.exJa}  →  ${w.exFr.slice(0, 50)}`);
console.log('— Échantillon NIVEAU 2 :');
for (const w of t2.slice(0, 8)) console.log(`   ${w.exJa}  →  ${w.exFr.slice(0, 50)}`);
console.log('\n— Début de l\'ordre kanji :', kanji.slice(0, 12).map((k) => `${k.character}(${k.level},g${k.grade})`).join(' '));
console.log('— Fin de l\'ordre kanji :', kanji.slice(-6).map((k) => `${k.character}(${k.level},g${k.grade})`).join(' '));
console.log('\n— Début de l\'ordre vocabulaire :', [...words].sort((a, b) => a.orderIdx - b.orderIdx).slice(0, 14).map((w) => w.word).join(' · '));
console.log('— Suite (mots 15-28) :', [...words].sort((a, b) => a.orderIdx - b.orderIdx).slice(14, 28).map((w) => w.word).join(' · '));
