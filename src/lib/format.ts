/** Helpers de formatage partagés. */

/** unknown[] <- JSON string (avec repli sûr). */
export function parseList(json: string | null | undefined): unknown[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Lectures kun : retire okurigana points "よ.む" → "よむ" et préfixes "-び" → "び". */
export function cleanKunyomi(kun: string): string[] {
  return kun
    .split("、")
    .map((s) => s.replace(/[.\-]/g, "").trim())
    .filter(Boolean);
}

export function splitOnyomi(on: string): string[] {
  return on.split("、").map((s) => s.trim()).filter(Boolean);
}

/** Découpe une liste de sens français "a; b; c". */
export function splitMeanings(s: string): string[] {
  return s.split(/;|\//).map((x) => x.trim()).filter(Boolean);
}

/** "v5u, vi" -> étiquettes lisibles. */
const POS_LABELS: Record<string, string> = {
  n: "nom",
  v1: "verbe ichidan",
  v5u: "verbe godan",
  v5r: "verbe godan",
  v5k: "verbe godan",
  v5s: "verbe godan",
  v5t: "verbe godan",
  v5g: "verbe godan",
  v5m: "verbe godan",
  v5b: "verbe godan",
  v5n: "verbe godan",
  v5aru: "verbe godan",
  vz: "verbe suru",
  vs: "verbe suru",
  "vs-i": "verbe suru",
  adj: "adjectif",
  "adj-i": "adjectif en i",
  "adj-na": "adjectif en na",
  "adj-no": "adjectif en no",
  "adj-t": "adjectif en ta",
  adv: "adverbe",
  int: "interjection",
  pn: "pronom",
  conj: "conjonction",
  prt: "particule",
  ctr: "compteur",
  exp: "expression",
  cop: "copule",
  aux: "auxiliaire",
};

export function posLabel(pos: string[]): string[] {
  return pos.map((p) => POS_LABELS[p] ?? p).filter(Boolean);
}
