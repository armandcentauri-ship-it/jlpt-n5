/**
 * Test complet de la conversion romaji → kana pour toute la famille du « n ».
 * Simule la frappe réelle du KanaInput : chaque touche reconvertit la valeur
 * accumulée (value = toKana(value + touche)), comme dans l'app.
 *
 * Usage : node --experimental-strip-types --no-warnings scripts/test-kana-n.mjs
 */
const { toKana, finalizeKana } = await import("../src/lib/romaji.ts");

/** Frappe touche par touche, exactement comme KanaInput. */
function typeKeys(s) {
  let v = "";
  for (const ch of s) v = toKana(v + ch);
  return v;
}

/** [(saisie, attendu à l'écran, attendu après validation)] — attendu validation = finalize. */
const CASES = [
  // — rangée な entière —
  ["na", "な"], ["ni", "に"], ["nu", "ぬ"], ["ne", "ね"], ["no", "の"],
  // — rangée ny (ya row) —
  ["nya", "にゃ"], ["nyu", "にゅ"], ["nyo", "にょ"],
  // — ん seul : isolé en attente, validé → ん ; « nn » → 1er ん posé, 2e en attente —
  ["n", "n", "ん"],
  ["nn", "んn", "ん"],
  ["n'", "ん"],
  // — n + voyelles par frappe progressive (n affiché en attente puis converti) —
  ["nana", "なな"], ["nani", "なに"], ["nin", "にn", "にん"],
  ["nuno", "ぬの"], ["nene", "ねね"], ["nono", "のの"],
  // — mots courants avec ん devant consonne —
  ["genki", "げんき"], ["sanpo", "さんぽ"], ["senpai", "せんぱい"],
  ["junbi", "じゅんび"], ["ganbatte", "がんばって"],
  ["nihongo", "にほんご"], ["sensei", "せんせい"], ["sanbi", "さんび"],
  // — ん devant la rangée な (frappe "nn") —
  ["konna", "こんな"], ["minna", "みんな"], ["mannaka", "まんなか"],
  ["sonna", "そんな"], ["annai", "あんない"],
  // — ん devant la rangée や : explicite via apostrophe —
  ["n'ya", "んや"], ["n'yu", "んゆ"], ["n'yo", "んよ"],
  ["kan'you", "かんよう"],
  // — n final de mot : en attente à l'écran (pour laisser kane → かね), ん à la validation —
  ["kon", "こn", "こん"], ["san", "さn", "さん"], ["pan", "ぱn", "ぱん"],
  ["kinen", "きねn", "きねん"], ["nyan", "にゃn", "にゃん"], ["hon", "ほn", "ほん"],
  ["zenin", "ぜにn", "ぜにん"], ["sannen", "さんねn", "さんねん"],
  // — raccourci « nn » final (habitude IME) : fusionne avec le ん déjà posé —
  ["kann", "かんn", "かん"], ["minn", "みんn", "みん"], ["rann", "らんn", "らん"],
  // — « nn » suivi d'une consonne : littéral, comme les IME réels (kannki → かんんき) —
  ["kannki", "かんんき"],
  // — n + ponctuation / espace / trait d'union (ー = marque de prolongation) —
  ["un!", "うん！"], ["un.", "うん。"], ["san ", "さん "], ["a-", "あー"],
];

let ok = true;
for (const [input, wantTyped, wantFinal] of CASES) {
  const typed = typeKeys(input);
  const final = finalizeKana(typed);
  const passTyped = typed === wantTyped;
  const passFinal = wantFinal === undefined || final === wantFinal;
  ok = ok && passTyped && passFinal;
  const tag = passTyped && passFinal ? "OK    " : "ÉCHEC ";
  const extra = wantFinal === undefined ? "" : ` | validé: ${JSON.stringify(final)}${passFinal ? "" : ` (attendu ${JSON.stringify(wantFinal)})`}`;
  console.log(`${tag} "${input}" → écran: ${JSON.stringify(typed)}${passTyped ? "" : ` (attendu ${JSON.stringify(wantTyped)})`}${extra}`);
}

console.log(ok ? "\n=== TOUS LES TESTS PASSENT ===" : "\n=== DES ÉCHECS À CORRIGER ===");
process.exit(ok ? 0 : 1);
