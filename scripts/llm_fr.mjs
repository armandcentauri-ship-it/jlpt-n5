#!/usr/bin/env node
/* Remplissage LLM pour l'app japonais N5 :
 *  1. sens FR manquants (kanji + mots)
 *  2. traductions FR des phrases d'exemple + flag difficulté
 *  3. lecture kana des phrases sans furigana
 *  4. génération de phrases pour les mots sans exemple
 * Progression incrémentale : data/llm_out.json (relance = reprend où c'est resté).
 */
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const DATA = '/home/z/my-project/data';
const OUT = `${DATA}/llm_out.json`;
const load = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const words = load(`${DATA}/words.json`);
const kanji = load(`${DATA}/kanji.json`);
const todo = load(`${DATA}/llm_todo.json`);

let out = fs.existsSync(OUT) ? load(OUT) : { meanings: {}, sentences: {}, kana: {}, generated: {} };
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 1));

const zai = await ZAI.create();
let calls = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chatJSON(system, user) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      calls++;
      await sleep(600); // garde anti-429
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: system },
          { role: 'user', content: user },
        ],
        thinking: { type: 'disabled' },
      });
      let text = completion.choices[0]?.message?.content || '';
      text = text.replace(/```json|```/g, '').trim();
      const m = text.match(/[[{][\s\S]*[\]}]/);
      if (!m) throw new Error('pas de JSON');
      return JSON.parse(m[0]);
    } catch (e) {
      const is429 = /429|Too many/i.test(String(e.message));
      const wait = is429 ? Math.min(20000 * attempt, 60000) : 3000 * attempt;
      console.error(`\n  appel échoué (${attempt}/6, ${is429 ? '429' : 'erreur'}): pause ${wait / 1000}s`);
      if (attempt === 6) return null;
      await sleep(wait);
    }
  }
}

async function runBatches(items, size, worker, concurrency = 2) {
  const batches = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  let done = 0;
  const queue = [...batches];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (queue.length) {
        const batch = queue.shift();
        await worker(batch);
        done++;
        process.stdout.write(`\r  lots ${done}/${batches.length} (appels: ${calls})   `);
        if (done % 3 === 0) save();
      }
    })
  );
  process.stdout.write('\n');
}

/* ---------- 1. sens FR manquants ---------- */
const missingMeanings = todo.meanings.filter((m) => !(m.key in out.meanings));
console.log(`Sens FR manquants: ${missingMeanings.length}`);
if (missingMeanings.length) {
  await runBatches(missingMeanings, 25, async (batch) => {
    const lines = batch.map((m) => JSON.stringify({ key: m.key, en: m.en }));
    const res = await chatJSON(
      'Tu es un traducteur japonais->français expert en didactique JLPT. Pour chaque entrée, traduis le sens anglais en 1 à 3 sens français COURTS (infinitif pour les verbes, sans article). Réponds UNIQUEMENT en JSON: [{"key":"...","fr":["sens1","sens2"]}]',
      lines.join('\n')
    );
    if (Array.isArray(res)) for (const r of res) if (r?.key && Array.isArray(r.fr) && r.fr.length) out.meanings[r.key] = r.fr.slice(0, 4);
  });
  save();
}

/* ---------- 2. traductions FR des phrases ---------- */
const toTranslate = todo.sentences.filter((s) => out.sentences[s.wid] === undefined);
console.log(`Phrases à traduire: ${toTranslate.length}`);
if (toTranslate.length) {
  await runBatches(toTranslate, 20, async (batch) => {
    const lines = batch.map((s, i) => `${i}: ja="${s.ja}" en="${s.en || ''}"`);
    const res = await chatJSON(
      `Tu es un traducteur japonais->français. Pour chaque phrase: "fr" = traduction française naturelle et fidèle (pas une traduction mot à mot). "dif" = "simple" si la phrase est de grammaire JLPT N5 de base (phrases courtes, présent/passé, pas d'argot, pas de passif/潜在的 complexité) utilisable telle quelle dans un exercice de production, sinon "avance". Réponds UNIQUEMENT en JSON: [{"i":0,"fr":"...","dif":"simple|avance"}]`,
      lines.join('\n')
    );
    if (Array.isArray(res)) for (const r of res) if (r && r.i !== undefined && batch[r.i]) out.sentences[batch[r.i].wid] = { fr: r.fr || '', dif: r.dif === 'simple' ? 'simple' : 'avance' };
  });
  save();
}

/* ---------- 3. lecture kana des phrases sans furigana ---------- */
const KANJI_RE = /[\u4e00-\u9faf\u3005\u3006\u30f6\u30fbー々]/;
const needKana = [];
for (const s of todo.sentences) {
  const w = words[s.wid];
  if (w && !w.exKana && s.ja && KANJI_RE.test(s.ja) && out.kana[s.wid] === undefined) {
    needKana.push({ wid: s.wid, ja: s.ja });
  }
}
console.log(`Phrases nécessitant lecture kana: ${needKana.length}`);
if (needKana.length) {
  await runBatches(needKana, 30, async (batch) => {
    const lines = batch.map((s, i) => `${i}: ${s.ja}`);
    const res = await chatJSON(
      'Pour chaque phrase japonaise, donne sa lecture COMPLÈTE en hiragana/katakana (sans aucun kanji, ん inchangé, ponctuation conservée). Réponds UNIQUEMENT en JSON: [{"i":0,"kana":"..."}]',
      lines.join('\n')
    );
    if (Array.isArray(res)) for (const r of res) if (r && r.i !== undefined && batch[r.i]) out.kana[batch[r.i].wid] = r.kana || '';
  });
  save();
}

/* ---------- 4. génération de phrases pour mots sans exemple ---------- */
const toGen = todo.no_example.filter((wid) => out.generated[wid] === undefined);
console.log(`Phrases à générer: ${toGen.length}`);
if (toGen.length) {
  await runBatches(toGen, 10, async (batch) => {
    const lines = batch.map((wid) => {
      const w = words[wid];
      return JSON.stringify({ i: wid, word: w.word, reading: w.reading, fr: w.meaningFr || w.meaningEn });
    });
    const res = await chatJSON(
      `Pour chaque mot de vocabulaire japonais N5, écris UNE phrase d'exemple TRÈS SIMPLE (grammaire JLPT N5 de base, moins de 20 caractères, le mot apparaît tel quel ou conjugué simplement). Fournis ja (avec kanji), kana (lecture complète), fr (traduction française). Réponds UNIQUEMENT en JSON: [{"i":0,"ja":"...","kana":"...","fr":"..."}]`,
      lines.join('\n')
    );
    if (Array.isArray(res)) for (const r of res) if (r && r.i !== undefined) out.generated[r.i] = { ja: r.ja || '', kana: r.kana || '', fr: r.fr || '', dif: 'simple' };
  });
  save();
}

/* ---------- fusion finale ---------- */
let merged = { fr: 0, kana: 0, gen: 0, meaningsK: 0, meaningsW: 0 };
const meaningByKey = (key, type) => {
  const v = out.meanings[key];
  if (!v) return null;
  merged[type === 'kanji' ? 'meaningsK' : 'meaningsW']++;
  return v;
};
for (const k of kanji) {
  if (!k.meaningsFr.length) {
    const fr = meaningByKey(k.character, 'kanji');
    if (fr) k.meaningsFr = fr;
  }
}
for (const w of words) {
  if (!w.meaningFr) {
    const fr = meaningByKey(`${w.word}::${w.reading}`, 'word');
    if (fr) w.meaningFr = fr.join('; ');
  }
  if (w.exJa) {
    const tr = out.sentences[w.wid];
    if (tr) { w.exFr = tr.fr; w.exDif = tr.dif; merged.fr++; }
  } else {
    const g = out.generated[w.wid];
    if (g) {
      w.exJa = g.ja; w.exFr = g.fr; w.exDif = 'simple';
      w.exKana = g.kana; w.exEn = ''; merged.gen++;
    }
  }
  if (!w.exKana && w.exJa) {
    const k = out.kana[w.wid];
    if (k) { w.exKana = k; merged.kana++; }
  }
}
fs.writeFileSync(`${DATA}/words.json`, JSON.stringify(words, null, 1));
fs.writeFileSync(`${DATA}/kanji.json`, JSON.stringify(kanji, null, 1));

const noFr = words.filter((w) => !w.meaningFr).length;
const noExFr = words.filter((w) => w.exJa && !w.exFr).length;
const noKana = words.filter((w) => w.exJa && !w.exKana).length;
const noKanjiFr = kanji.filter((k) => !k.meaningsFr.length).length;
const simple = words.filter((w) => w.exDif === 'simple').length;
console.log(`\nFusion: ${JSON.stringify(merged)}`);
console.log(`Après fusion: mots sans FR: ${noFr} | phrases sans FR: ${noExFr} | sans kana: ${noKana} | kanji sans FR: ${noKanjiFr}`);
console.log(`Phrases "simple" (exercices de production): ${simple}/${words.length}`);
