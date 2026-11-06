/**
 * Tests de la conversion romaji → kana (src/lib/romaji.ts).
 * Chaque entrée teste la chaîne ACCUMULÉE au fur et à mesure de la frappe :
 * c'est l'équivalent exact d'une saisie touche par touche.
 *
 * Usage : node --experimental-strip-types --no-warnings scripts/test-romaji.mjs
 */
import { toKana, finalizeKana } from "../src/lib/romaji.ts";

/* séquences tapées lettre à lettre → état final attendu à chaque étape */
const sequences = [
  // voyelles : na ni nu ne no
  { tape: "na", etats: { n: "n", na: "な" } },
  { tape: "ni", etats: { n: "n", ni: "に" } },
  { tape: "nu", etats: { n: "n", nu: "ぬ" } },
  { tape: "ne", etats: { n: "n", ne: "ね" } },
  { tape: "no", etats: { n: "n", no: "の" } },
  // yōon : nya nyu nyo (le bug signalé)
  { tape: "nya", etats: { n: "n", ny: "ny", nya: "にゃ" } },
  { tape: "nyu", etats: { n: "n", ny: "ny", nyu: "にゅ" } },
  { tape: "nyo", etats: { n: "n", ny: "ny", nyo: "にょ" } },
  // nn → ん explicite
  { tape: "nna", etats: { n: "n", nn: "んn", nna: "んな" } },
  // n' → ん forcé (devant y)
  { tape: "n'yu", etats: { n: "n", "n'": "ん", "n'y": "んy", "n'yu": "んゆ" } },
  // n + consonnes : ん immédiat
  { tape: "nka", etats: { n: "n", nk: "んk", nka: "んか" } },
  { tape: "nsa", etats: { n: "n", ns: "んs", nsa: "んさ" } },
  { tape: "nta", etats: { n: "n", nt: "んt", nta: "んた" } },
  { tape: "nda", etats: { n: "n", nd: "んd", nda: "んだ" } },
  { tape: "nba", etats: { n: "n", nb: "んb", nba: "んば" } },
  { tape: "npa", etats: { n: "n", np: "んp", npa: "んぱ" } },
  { tape: "nma", etats: { n: "n", nm: "んm", nma: "んま" } },
  { tape: "nra", etats: { n: "n", nr: "んr", nra: "んら" } },
  { tape: "nwa", etats: { n: "n", nw: "んw", nwa: "んわ" } },
  { tape: "nja", etats: { n: "n", nj: "んj", nja: "んじゃ" } },
  { tape: "nza", etats: { n: "n", nz: "んz", nza: "んざ" } },
  { tape: "nga", etats: { n: "n", ng: "んg", nga: "んが" } },
  { tape: "nha", etats: { n: "n", nh: "んh", nha: "んは" } },
  { tape: "nch", etats: { n: "n", nc: "んc", nch: "んch" } },
  { tape: "ncha", etats: { ncha: "んちゃ" } },
  // mots complets
  { tape: "sensei", etats: { sensei: "せんせい" } },
  { tape: "onna", etats: { onna: "おんな" } },
  { tape: "sanbi", etats: { sanbi: "さんび" } },
  { tape: "genki", etats: { genki: "げんき" } },
  { tape: "minyu", etats: { minyu: "みにゅ" } },
  { tape: "hannichi", etats: { hannichi: "はんにち" } },
  { tape: "sen'yuu", etats: { "sen'yuu": "せんゆう" } },
  { tape: "kon'nichiwa", etats: { "kon'nichiwa": "こんにちわ" } },
];

/* n final au moment de valider (finalize) */
const finalisations = [
  ["kan", "かん"], ["hon", "ほん"], ["shin", "しん"],
  ["san", "さん"], ["kon", "こん"], ["ban", "ばん"],
];

let echecs = 0;
let total = 0;

for (const seq of sequences) {
  for (const [saisie, attendu] of Object.entries(seq.etats)) {
    total++;
    const got = toKana(saisie);
    if (got !== attendu) {
      echecs++;
      console.log(`ÉCHEC  "${saisie}"  →  ${got}   (attendu ${attendu})  [séquence « ${seq.tape} »]`);
    } else {
      console.log(`ok     "${saisie}"  →  ${got}`);
    }
  }
}

for (const [saisie, attendu] of finalisations) {
  total++;
  const got = finalizeKana(saisie);
  if (got !== attendu) {
    echecs++;
    console.log(`ÉCHEC  finalize("${saisie}")  →  ${got}   (attendu ${attendu})`);
  } else {
    console.log(`ok     finalize("${saisie}")  →  ${got}`);
  }
}

console.log(`\n${total - echecs}/${total} tests réussis${echecs ? ` — ${echecs} ÉCHEC(S)` : " — tout est bon ✅"}`);
process.exit(echecs ? 1 : 0);
