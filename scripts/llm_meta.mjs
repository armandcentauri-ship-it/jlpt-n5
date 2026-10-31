#!/usr/bin/env node
/* Classification thématique du vocabulaire N5 via LLM.
 * Pour chaque mot : thème (clé parmi THEMES) + fundamentalité n (1 = très basique → 5 = spécifique).
 * Cache incrémental : data/llm_meta.json — relance = reprend où c'est resté.
 * Sortie fusionnée ensuite par finalize_meta.mjs.
 */
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

const DATA = '/home/z/my-project/data';
const OUT = `${DATA}/llm_meta.json`;
const load = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

export const THEMES = [
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
  ['divers', 'Divers'],
];

const THEME_KEYS = THEMES.map(([k]) => k);
const THEME_DOC = THEMES.map(([k, l]) => `  - ${k} : ${l}`).join('\n');

const words = load(`${DATA}/words.json`);
let out = fs.existsSync(OUT) ? load(OUT) : {};
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 0));

const zai = await ZAI.create();
let calls = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chatJSON(system, user) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      calls++;
      await sleep(500); // garde anti-429
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

const SYSTEM = `Tu es un expert de l'enseignement du japonais (niveaux JLPT N5/N4), pédagogue avec des débutants francophones.
Pour chaque mot de vocabulaire, tu attribues :
- "t" : UN thème parmi ces clés EXACTES :
${THEME_DOC}
Règles de thème : les pronoms et mots déictiques (私、これ、ここ、どれ…) vont dans "base" ; les salutations et expressions de communication figée (はい、ありがとう、すみません、おはよう…) dans "politesse" ; les particules/conjonctions/expressions grammaticales (でも、から、まで、ね、だけ) dans "connecteurs" ; les adverbes de degré/fréquence/manière (とても、よく、時々、ゆっくり、もう、全部…) dans "adverbes" ; les nombres/compteurs/quantités dans "nombres" ; les mots de position/direction (上、下、中、前、後ろ、右、左、隣、北、西…) dans "position" ; les pays/villes/régions (国、外国、日本…) dans "lieux" et les langues (英語、日本語…) dans "ecole" ; les activités/événements/médias de loisir (歌、映画、音楽、スポーツ、テレビ、写真、パーティー、手紙、雑誌、新聞…) dans "loisirs" ; TOUS les adjectifs (い ou な, y compris couleurs-qualités comme 青い) dans "adjectifs" ; les verbes dans l'un des 4 thèmes verbes : "verbes_base" (する、ある、いる、なる、できる、わかる、です系), "verbes_mvt" (déplacement : 行く、来る、帰る、乗る、歩く、走る…), "verbes_comm" (言う、聞く、話す、読む、書く、思う、会う、教える、覚える…), "verbes_vie" (tous les autres : 食べる、飲む、買う、作る、寝る、見る、遊ぶ、洗う…).
IMPORTANT : "divers" est un refuge de DERNIER recours (< 5% des mots) — tout objet concret de la vie quotidienne doit aller dans maison/lieux/nourriture/vêtements etc. Un objet porté (かばん、シャツ、傘、靴…) va dans "maison" ; un objet domestique/outil (カップ、紙、カメラ、時計、電話…) dans "maison" ; un commerce/bâtiment (銀行、喫茶店…) dans "lieux". Ne réponds JAMAIS "divers" si un autre thème colle raisonnablement.
- "n" : fundamentalité DANS son thème, de 1 (mot ultra-courant, à apprendre en premier) à 5 (mot spécifique, moins prioritaire).
Réponds UNIQUEMENT en JSON : [{"i":<wid>,"t":"clé","n":2}]`;

const redoDivers = process.argv.includes('--redo-divers');
if (redoDivers) {
  let n = 0;
  for (const [wid, m] of Object.entries(out)) if (m.t === 'divers') { delete out[Number(wid)]; n++; }
  console.log(`Reclassement forcé de ${n} mots "divers"`);
}
const toDo = words.filter((w) => out[w.wid] === undefined);
console.log(`Mots à classer: ${toDo.length}/${words.length}`);

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

if (toDo.length) {
  await runBatches(toDo, 28, async (batch) => {
    const lines = batch.map((w) => {
      const fr = (w.meaningFr || w.meaningEn || '').split(';')[0].slice(0, 60);
      return JSON.stringify({ i: w.wid, word: w.word, kana: w.reading, fr, pos: (w.pos || []).join(',') });
    });
    const res = await chatJSON(SYSTEM, lines.join('\n'));
    if (Array.isArray(res)) {
      for (const r of res) {
        if (r && r.i !== undefined && THEME_KEYS.includes(r.t)) {
          out[r.i] = { t: r.t, n: Math.max(1, Math.min(5, Number(r.n) || 3)) };
        }
      }
    }
  });
  save();
}

// seconde passe pour les manquants éventuels (lots plus petits)
const still = words.filter((w) => out[w.wid] === undefined);
if (still.length) {
  console.log(`Seconde passe pour ${still.length} mots…`);
  await runBatches(still, 12, async (batch) => {
    const lines = batch.map((w) =>
      JSON.stringify({ i: w.wid, word: w.word, kana: w.reading, fr: (w.meaningFr || '').split(';')[0] })
    );
    const res = await chatJSON(SYSTEM, lines.join('\n'));
    if (Array.isArray(res)) {
      for (const r of res) {
        if (r && r.i !== undefined && THEME_KEYS.includes(r.t)) {
          out[r.i] = { t: r.t, n: Math.max(1, Math.min(5, Number(r.n) || 3)) };
        }
      }
    }
  });
  save();
}

const missing = words.filter((w) => out[w.wid] === undefined).length;
const fromCount = {};
for (const w of words) {
  const m = out[w.wid];
  if (m) fromCount[m.t] = (fromCount[m.t] || 0) + 1;
}
console.log(`\nTerminé. Manquants (→ divers au merge): ${missing}`);
console.log('Répartition par thème :');
for (const [k, l] of THEMES) console.log(`  ${k.padEnd(14)} ${String(fromCount[k] || 0).padStart(4)}  ${l}`);
