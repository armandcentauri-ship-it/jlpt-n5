/* Conversion romaji → hiragana (clavier japonais intégré, façon IME).
   Les caractères non-ASCII (kana/kanji déjà tapés) passent tels quels ;
   les séquences romaji incomplètes restent en attente jusqu'au prochain trait. */

const SMALL_TSU: Record<string, string> = {
  xtu: "っ", ltu: "っ", xtsu: "っ", ltsu: "っ",
};

const DIGRAPH: Record<string, string> = {
  kya: "きゃ", kyu: "きゅ", kyo: "きょ",
  gya: "ぎゃ", gyu: "ぎゅ", gyo: "ぎょ",
  sha: "しゃ", shu: "しゅ", sho: "しょ", shi: "し",
  sya: "しゃ", syu: "しゅ", syo: "しょ",
  cha: "ちゃ", chu: "ちゅ", cho: "ちょ", chi: "ち",
  cya: "ちゃ", cyu: "ちゅ", cyo: "ちょ",
  tya: "ちゃ", tyu: "ちゅ", tyo: "ちょ",
  ja: "じゃ", ju: "じゅ", jo: "じょ",
  jya: "じゃ", jyu: "じゅ", jyo: "じょ",
  zya: "じゃ", zyu: "じゅ", zyo: "じょ",
  ji: "じ",
  hya: "ひゃ", hyu: "ひゅ", hyo: "ひょ",
  bya: "びゃ", byu: "びゅ", byo: "びょ",
  pya: "ぴゃ", pyu: "ぴゅ", pyo: "ぴょ",
  mya: "みゃ", myu: "みゅ", myo: "みょ",
  rya: "りゃ", ryu: "りゅ", ryo: "りょ",
  nya: "にゃ", nyu: "にゅ", nyo: "にょ",
  fya: "ふゃ", fyu: "ふゅ", fyo: "ふょ",
  tsu: "つ", tsa: "つぁ", tsi: "つぃ", tse: "つぇ", tso: "つぉ",
  she: "しぇ", che: "ちぇ",
  wha: "うぁ",
};

const BASIC: Record<string, string> = {
  a: "あ", i: "い", u: "う", e: "え", o: "お",
  ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ",
  ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご",
  sa: "さ", su: "す", se: "せ", so: "そ",
  za: "ざ", zi: "じ", zu: "ず", ze: "ぜ", zo: "ぞ",
  ta: "た", te: "て", to: "と",
  da: "だ", di: "ぢ", du: "づ", de: "で", do: "ど",
  na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の",
  ha: "は", hi: "ひ", fu: "ふ", hu: "ふ", he: "へ", ho: "ほ",
  ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ",
  pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ",
  ma: "ま", mi: "み", mu: "む", me: "め", mo: "も",
  ya: "や", yu: "ゆ", yo: "よ",
  ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ",
  wa: "わ", wi: "うぃ", we: "うぇ", wo: "を",
  vu: "ゔ",
  fa: "ふぁ", fi: "ふぃ", fe: "ふぇ", fo: "ふぉ",
  ti: "てぃ",
};

const PUNCT: Record<string, string> = {
  "-": "ー", ".": "。", ",": "、", "!": "！", "?": "？", "~": "〜", " ": " ",
};

const VOWELS = "aiueo";
const CONSONANTS = "kstcpgzdbhfvjqrwy";

/** Convertit une chaîne (romaji + kana mixés) en hiragana. */
export function toKana(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    const chL = ch.toLowerCase();
    const rest = input.slice(i).toLowerCase();

    // 1) petit tsu explicite (xtu, ltsu…)
    let matched = false;
    for (const [rom, kana] of Object.entries(SMALL_TSU)) {
      if (rest.startsWith(rom)) {
        out += kana;
        i += rom.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // caractères non latins / non ponctuation : pass-through
    if (!/[a-z\-,.!?~ ]/.test(chL)) {
      out += ch;
      i += 1;
      continue;
    }

    // 2) sokuon : consonne doublée (sauf n) → っ
    const nextL = (input[i + 1] ?? "").toLowerCase();
    if (chL !== "n" && CONSONANTS.includes(chL) && nextL === chL) {
      out += "っ";
      i += 1;
      continue;
    }

    // 3) digrammes / trigrammes (longueur 4 → 2)
    for (let len = 4; len >= 2; len--) {
      const sub = rest.slice(0, len);
      if (sub.length < len) continue;
      if (DIGRAPH[sub]) {
        out += DIGRAPH[sub];
        i += len;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // 4) n / nn / n' → ん (n suivi d'une consonne, d'un autre n, d'une
    //    ponctuation/espace, d'une apostrophe ou en fin de mot ;
    //    n suivi d'une voyelle → syllabe BASIC : "kana" → かな)
    if (chL === "n") {
      const after = (input[i + 1] ?? "").toLowerCase();
      const stopsN =
        after === "" ||
        after === "'" ||
        after === "n" ||
        CONSONANTS.includes(after) ||
        !/[a-z]/.test(after);
      if (stopsN) {
        out += "ん";
        i += after === "'" ? 2 : 1;
        continue;
      }
    }

    // 5) syllabes de base (2 puis 1)
    const two = rest.slice(0, 2);
    if (two.length === 2 && BASIC[two]) {
      out += BASIC[two];
      i += 2;
      continue;
    }
    if (PUNCT[chL]) {
      out += PUNCT[chL];
      i += 1;
      continue;
    }
    if (VOWELS.includes(chL)) {
      out += BASIC[chL];
      i += 1;
      continue;
    }

    // 6) consonne seule en attente : conservée jusqu'au prochain trait
    out += ch;
    i += 1;
  }
  return out;
}

/** Katakana → hiragana (ー et kanji inchangés). */
export function katakanaToHiragana(s: string): string {
  return s.replace(/[\u30A1-\u30F6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}
