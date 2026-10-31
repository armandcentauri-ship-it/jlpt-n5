/* Moteur de conjugaison japonaise : godan (五段), ichidan (一段), suru (サ変), kuru (カ変).
   Conjugue en parallèle la forme écrite (kanji + okurigana) et la lecture kana :
   le remplacement s'applique à la fin des deux chaînes, qui partagent la même
   terminaison en okurigana (ex. 飲む/のむ → 飲んだ/のんだ). */

import type { WordItem } from "./types";

export type ConjGroup = "godan" | "ichidan" | "suru" | "kuru";

export type FormKey =
  | "pres"
  | "pres_neg"
  | "pol"
  | "pol_neg"
  | "past"
  | "past_neg"
  | "past_pol"
  | "past_pol_neg"
  | "te"
  | "te_neg";

export const FORM_KEYS: FormKey[] = [
  "pres",
  "pres_neg",
  "pol",
  "pol_neg",
  "past",
  "past_neg",
  "past_pol",
  "past_pol_neg",
  "te",
  "te_neg",
];

export interface ConjFormDef {
  key: FormKey;
  label: string;
  hint: string;
}

/** Les 10 formes travaillées (affirmatif + négatif quand applicable). */
export const CONJ_FORMS: ConjFormDef[] = [
  { key: "pres", label: "Présent neutre", hint: "forme du dictionnaire" },
  { key: "pres_neg", label: "Présent neutre, négatif", hint: "〜ない" },
  { key: "pol", label: "Présent poli", hint: "〜ます" },
  { key: "pol_neg", label: "Présent poli, négatif", hint: "〜ません" },
  { key: "past", label: "Passé neutre", hint: "〜た" },
  { key: "past_neg", label: "Passé neutre, négatif", hint: "〜なかった" },
  { key: "past_pol", label: "Passé poli", hint: "〜ました" },
  { key: "past_pol_neg", label: "Passé poli, négatif", hint: "〜ませんでした" },
  { key: "te", label: "Forme en -te", hint: "〜て" },
  { key: "te_neg", label: "Forme en -te, négative", hint: "〜ないで" },
];

export const GROUP_LABELS: Record<ConjGroup, string> = {
  godan: "五段 godan · groupe 1",
  ichidan: "一段 ichidan · groupe 2",
  suru: "する suru · groupe 3",
  kuru: "来る irrégulier · groupe 3",
};

export const GROUP_SHORT: Record<ConjGroup, string> = {
  godan: "五段",
  ichidan: "一段",
  suru: "する",
  kuru: "来る",
};

export interface ConjForm {
  kanji: string; // forme écrite
  kana: string; // lecture
  alts?: string[]; // variantes acceptées (ex. なくて pour ないで)
}

export interface VerbItem {
  id: string; // Word.id (pour le SRS : itemId = `${id}:${form}`)
  wid: number;
  word: string; // forme dictionnaire affichée (する ajouté aux verbes suru nus)
  reading: string; // lecture dictionnaire (idem)
  level: string; // "N5" | "N4"
  meaningFr: string;
  group: ConjGroup;
  orderIdx: number;
  isSpecialIku: boolean; // 行く → 行って/行った
  isSpecialAru: boolean; // ある → négation ない (irrégulier)
}

/* ------------------------- tiges godan ------------------------- */

const U2A: Record<string, string> = {
  う: "わ", く: "か", ぐ: "が", す: "さ", つ: "た", ぬ: "な", ぶ: "ば", む: "ま", る: "ら",
};
const U2I: Record<string, string> = {
  う: "い", く: "き", ぐ: "ぎ", す: "し", つ: "ち", ぬ: "に", ぶ: "び", む: "み", る: "り",
};
const U2TA: Record<string, string> = {
  う: "った", く: "いた", ぐ: "いだ", す: "した", つ: "った", ぬ: "んだ", ぶ: "んだ", む: "んだ", る: "った",
};

interface Stems {
  base: string; // racine sans la terminaison
  pres: string; // forme dictionnaire (peut différer pour suru)
  nai: string; // base du négatif (avant ない)
  masu: string; // base du poli (avant ます)
  ta: string; // forme complète au passé neutre
  te: string; // forme complète en -te
}

function godanStems(s: string): Stems | null {
  const last = s[s.length - 1];
  if (!last || !U2A[last]) return null;
  const base = s.slice(0, -1);
  const ta = U2TA[last];
  return {
    base,
    pres: s,
    nai: base + U2A[last],
    masu: base + U2I[last],
    ta: base + ta,
    te: base + (ta.endsWith("だ") ? ta.slice(0, -1) + "で" : ta.slice(0, -1) + "て"),
  };
}

function ichidanStems(s: string): Stems | null {
  if (!s.endsWith("る")) return null;
  const base = s.slice(0, -1);
  return { base, pres: s, nai: base, masu: base, ta: base + "た", te: base + "て" };
}

function suruStems(s: string): Stems {
  const base = s.endsWith("する") ? s.slice(0, -2) : s;
  return {
    base,
    pres: base + "する",
    nai: base + "し",
    masu: base + "し",
    ta: base + "した",
    te: base + "して",
  };
}

function stemsFor(group: ConjGroup, s: string): Stems | null {
  if (group === "godan") return godanStems(s);
  if (group === "ichidan") return ichidanStems(s);
  if (group === "suru") return suruStems(s);
  return null;
}

const F = (kanji: string, kana: string, alts?: string[]): ConjForm => ({ kanji, kana, alts });

/** Formes de 来る (kana : irrégulier く→こ / き). */
function kuruForms(word: string, reading: string): Record<FormKey, ConjForm> {
  const w = word.endsWith("る") ? word.slice(0, -1) : word; // 来
  const r = reading.endsWith("る") ? reading.slice(0, -1) : reading; // く
  return {
    pres: F(word, reading),
    pres_neg: F(w + "ない", "こない"),
    pol: F(w + "ます", "きます"),
    pol_neg: F(w + "ません", "きません"),
    past: F(w + "た", "きた"),
    past_neg: F(w + "なかった", "こなかった"),
    past_pol: F(w + "ました", "きました"),
    past_pol_neg: F(w + "ませんでした", "きませんでした"),
    te: F(w + "て", "きて"),
    te_neg: F(w + "ないで", "こないで", [w + "なくて", "こなくて"]),
  };
}

/** Conjugue un verbe dans les 10 formes (écrite + kana). */
export function conjugateVerb(
  v: Pick<VerbItem, "word" | "reading" | "group" | "isSpecialIku" | "isSpecialAru">
): Record<FormKey, ConjForm> {
  if (v.group === "kuru") return kuruForms(v.word, v.reading);

  const ws = stemsFor(v.group, v.word);
  const rs = stemsFor(v.group, v.reading);
  if (!ws || !rs) {
    // sécurité : verbe mal formé → recopie la forme dictionnaire
    const flat = F(v.word, v.reading);
    return Object.fromEntries(FORM_KEYS.map((k) => [k, flat])) as Record<FormKey, ConjForm>;
  }

  const out: Record<FormKey, ConjForm> = {
    pres: F(ws.pres, rs.pres),
    pres_neg: F(ws.nai + "ない", rs.nai + "ない"),
    pol: F(ws.masu + "ます", rs.masu + "ます"),
    pol_neg: F(ws.masu + "ません", rs.masu + "ません"),
    past: F(ws.ta, rs.ta),
    past_neg: F(ws.nai + "なかった", rs.nai + "なかった"),
    past_pol: F(ws.masu + "ました", rs.masu + "ました"),
    past_pol_neg: F(ws.masu + "ませんでした", rs.masu + "ませんでした"),
    te: F(ws.te, rs.te),
    te_neg: F(ws.nai + "ないで", rs.nai + "ないで", [ws.nai + "なくて", rs.nai + "なくて"]),
  };

  // 行く : passé / -te en って (v5k-s)
  if (v.isSpecialIku) {
    out.past = F(v.word.slice(0, -1) + "った", v.reading.slice(0, -1) + "った");
    out.te = F(v.word.slice(0, -1) + "って", v.reading.slice(0, -1) + "って");
  }
  // ある : négation irrégulière ない (jamais あらない)
  if (v.isSpecialAru) {
    out.pres_neg = F("ない", "ない");
    out.past_neg = F("なかった", "なかった");
    out.te_neg = F("ないで", "ないで", ["なくて"]);
  }
  return out;
}

/** Réponses acceptées pour une forme (kana d'abord, puis écrite, puis variantes). */
export function conjRefs(f: ConjForm): string[] {
  const refs = [f.kana, f.kanji];
  if (f.alts) refs.push(...f.alts);
  return refs;
}

/** Notation {kanji|kana} pour le composant Ruby, construite depuis word + reading. */
export function verbFurigana(word: string, reading: string): string {
  if (!/[一-龯]/.test(word)) return word; // pas de kanji : rien à annoter
  const m = word.match(/[ぁ-んァ-ヶー]+$/);
  const oku = m ? m[0] : ""; // okurigana final
  const stemK = word.slice(0, word.length - oku.length);
  const stemR = reading.slice(0, Math.max(0, reading.length - oku.length));
  if (!stemK || !stemR) return word;
  return `{${stemK}|${stemR}}${oku}`;
}

/* ------------------------- liste des verbes ------------------------- */

// Verbes suru courants (nom + する) hors thème "verbes_*" : sélection manuelle.
const SURU_EXTRA = new Set([
  "勉強", "結婚", "洗濯", "掃除", "電話", "料理", "旅行", "練習", "仕事", "質問",
  "テスト", "授業", "運転", "運動", "会議", "試験", "約束", "連絡", "準備", "紹介",
  "心配", "食事", "予約", "出発", "計画", "経験", "復習", "案内", "用意", "支度",
]);

/** Extrait et classe les verbes du vocabulaire (ordre pédagogique). */
export function buildVerbList(words: WordItem[]): VerbItem[] {
  const out: VerbItem[] = [];
  for (const w of words) {
    const pos = w.pos || [];
    let group: ConjGroup | null = null;
    if (pos.includes("vk")) group = "kuru";
    else if (pos.includes("v1")) group = "ichidan";
    else if (pos.some((p) => p.startsWith("v5"))) group = "godan";
    else if (pos.includes("vs") || pos.includes("vs-i")) {
      const isSuruVerb = w.word.endsWith("する") || w.theme.startsWith("verbes_") || SURU_EXTRA.has(w.word);
      if (isSuruVerb) group = "suru";
    }
    if (!group) continue;

    const word = group === "suru" && !w.word.endsWith("する") ? w.word + "する" : w.word;
    const reading = group === "suru" && !w.reading.endsWith("する") ? w.reading + "する" : w.reading;
    out.push({
      id: w.id,
      wid: w.wid,
      word,
      reading,
      level: w.level,
      meaningFr: w.meaningFr,
      group,
      orderIdx: w.orderIdx,
      isSpecialIku: w.word === "行く" || pos.includes("v5k-s"),
      isSpecialAru: w.word === "ある", // いる est aux-v dans JMdict mais reste régulier
    });
  }
  out.sort((a, b) => a.orderIdx - b.orderIdx || a.wid - b.wid);
  return out;
}
