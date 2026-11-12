/* Vérifie le calendrier SRS « conjugaison : 2 bonnes réponses = maîtrisé » */
import { applySm2 } from "../src/lib/srs.ts";

const now = new Date();
const M = 21; // seuil de maîtrise (jours)

function seq(mode, grades, label, itemType) {
  let state = null;
  const steps = [];
  for (const g of grades) {
    state = applySm2(state, g, now, mode, itemType);
    steps.push(`${g}:${state.intervalDays.toFixed(2)}j`);
  }
  const mastered = state.intervalDays >= M;
  console.log(`${label.padEnd(46)} ${steps.join(" → ")}  maîtrisé: ${mastered ? "OUI ✅" : "non"}`);
  return mastered;
}

console.log("— Conjugaison (mode conj) —");
const a = seq("conj", [2, 2], "2 bonnes réponses de suite (cas demandé)", undefined);
seq("conj", [2, 0, 2, 2], "bonne, erreur, puis 2 bonnes", undefined);
seq("conj", [2, 2, 2], "3 bonnes (l'intervalle continue de croître)", undefined);
// utilisateur existant : déjà 3 bonnes réponses (18,75 j) mais pas maîtrisé
const legacy = { ease: 2.5, intervalDays: 18.75, reps: 3, lapses: 0 };
const legacyNext = applySm2(legacy, 2, now, "conj");
console.log(`${"anciennes données (18,75 j) + 1 bonne réponse".padEnd(46)} → ${legacyNext.intervalDays.toFixed(2)}j  maîtrisé: ${legacyNext.intervalDays >= M ? "OUI ✅" : "non"}`);

console.log("\n— Phrases (itemType phrase, exercices JP↔FR) —");
const c = seq("ex_jp_fr", [2, 2], "2 bonnes réponses de suite (cas demandé)", "phrase");
seq("ex_fr_jp", [2, 0, 2, 2], "bonne, erreur, puis 2 bonnes", "phrase");
seq("ex_jp_fr", [2, 2, 2], "3 bonnes (l'intervalle continue de croître)", "phrase");
const legacyP = { ease: 2.5, intervalDays: 7.5, reps: 2, lapses: 0 };
const legacyPNext = applySm2(legacyP, 2, now, "ex_jp_fr", "phrase");
console.log(`${"anciennes données (7,5 j) + 1 bonne réponse".padEnd(46)} → ${legacyPNext.intervalDays.toFixed(2)}j  maîtrisé: ${legacyPNext.intervalDays >= M ? "OUI ✅" : "non"}`);

console.log("\n— Vocabulaire / kanji (mode flashcard) : doit rester inchangé —");
const b = seq("flashcard", [2, 2], "2 bonnes réponses (calendrier SM-2 normal)", "word");

console.log("\n" + (a && c && !b ? "RÉSULTAT : OK — conjugaison et phrases accélérées, vocab/kanji inchangés ✅" : "RÉSULTAT : PROBLÈME ❌"));
