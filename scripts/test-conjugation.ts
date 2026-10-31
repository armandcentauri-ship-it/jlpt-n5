/* Tests du moteur de conjugaison — exécuter : npx tsx scripts/test-conjugation.ts */
import {
  buildVerbList,
  conjRefs,
  conjugateVerb,
  verbFurigana,
  type ConjGroup,
  type FormKey,
} from "../src/lib/conjugation";

interface Case {
  word: string;
  reading: string;
  group: ConjGroup;
  iku?: boolean;
  aru?: boolean;
  expect: Partial<Record<FormKey, string>>; // forme kana attendue
}

const CASES: Case[] = [
  // godan — une terminaison de chaque rang う
  { word: "飲む", reading: "のむ", group: "godan", expect: { pres: "のむ", pres_neg: "のまない", pol: "のみます", pol_neg: "のみません", past: "のんだ", past_neg: "のまなかった", past_pol: "のみました", past_pol_neg: "のみませんでした", te: "のんで", te_neg: "のまないで" } },
  { word: "書く", reading: "かく", group: "godan", expect: { past: "かいた", te: "かいて", pres_neg: "かかない", pol: "かきます", te_neg: "かかないで" } },
  { word: "泳ぐ", reading: "およぐ", group: "godan", expect: { past: "およいだ", te: "およいで", pres_neg: "およがない" } },
  { word: "話す", reading: "はなす", group: "godan", expect: { past: "はなした", te: "はなして", pres_neg: "はなさない" } },
  { word: "待つ", reading: "まつ", group: "godan", expect: { past: "まった", te: "まって", pres_neg: "またない" } },
  { word: "死ぬ", reading: "しぬ", group: "godan", expect: { past: "しんだ", te: "しんで", pres_neg: "しなない" } },
  { word: "遊ぶ", reading: "あそぶ", group: "godan", expect: { past: "あそんだ", te: "あそんで", pres_neg: "あそばない" } },
  { word: "読む", reading: "よむ", group: "godan", expect: { past: "よんだ", te: "よんで", pol: "よみます" } },
  { word: "取る", reading: "とる", group: "godan", expect: { past: "とった", te: "とって", pres_neg: "とらない" } },
  { word: "買う", reading: "かう", group: "godan", expect: { past: "かった", te: "かって", pres_neg: "かわない", te_neg: "かわないで" } },
  { word: "思う", reading: "おもう", group: "godan", expect: { past: "おもった", te: "おもって", pres_neg: "おもわない" } },
  { word: "会う", reading: "あう", group: "godan", expect: { past: "あった", te: "あって" } },
  // spéciaux
  { word: "行く", reading: "いく", group: "godan", iku: true, expect: { past: "いった", te: "いって", pres_neg: "いかない", past_neg: "いかなかった", pol: "いきます" } },
  { word: "ある", reading: "ある", group: "godan", aru: true, expect: { pres: "ある", pres_neg: "ない", pol: "あります", pol_neg: "ありません", past: "あった", past_neg: "なかった", past_pol: "ありました", past_pol_neg: "ありませんでした", te: "あって", te_neg: "ないで" } },
  // ichidan
  { word: "食べる", reading: "たべる", group: "ichidan", expect: { pres: "たべる", pres_neg: "たべない", pol: "たべます", pol_neg: "たべません", past: "たべた", past_neg: "たべなかった", past_pol: "たべました", past_pol_neg: "たべませんでした", te: "たべて", te_neg: "たべないで" } },
  { word: "見る", reading: "みる", group: "ichidan", expect: { te: "みて", past: "みた", pol: "みます" } },
  { word: "起きる", reading: "おきる", group: "ichidan", expect: { te: "おきて", pres_neg: "おきない" } },
  { word: "開ける", reading: "あける", group: "ichidan", expect: { te: "あけて", past_pol_neg: "あけませんでした" } },
  // irréguliers
  { word: "する", reading: "する", group: "suru", expect: { pres: "する", pres_neg: "しない", pol: "します", pol_neg: "しません", past: "した", past_neg: "しなかった", past_pol: "しました", past_pol_neg: "しませんでした", te: "して", te_neg: "しないで" } },
  { word: "来る", reading: "くる", group: "kuru", expect: { pres: "くる", pres_neg: "こない", pol: "きます", pol_neg: "きません", past: "きた", past_neg: "こなかった", past_pol: "きました", past_pol_neg: "きませんでした", te: "きて", te_neg: "こないで" } },
  // suru avec radical
  { word: "勉強する", reading: "べんきょうする", group: "suru", expect: { pres: "べんきょうする", pres_neg: "べんきょうしない", pol: "べんきょうします", past: "べんきょうした", te: "べんきょうして", past_pol_neg: "べんきょうしませんでした", te_neg: "べんきょうしないで" } },
  { word: "コピーする", reading: "コピーする", group: "suru", expect: { pol: "コピーします", past: "コピーした" } },
  { word: "電話する", reading: "でんわする", group: "suru", expect: { pres_neg: "でんわしない", te: "でんわして" } },
  // godan ichidan-lookalike (要る いる est godan)
  { word: "要る", reading: "いる", group: "godan", expect: { past: "いる" === "いる" ? "いった" : "", te: "いって", pres_neg: "いらない" } },
];

let fails = 0;
for (const c of CASES) {
  const got = conjugateVerb({ word: c.word, reading: c.reading, group: c.group, isSpecialIku: !!c.iku, isSpecialAru: !!c.aru });
  for (const [form, want] of Object.entries(c.expect) as [FormKey, string][]) {
    if (!want) continue;
    const g = got[form];
    if (g.kana !== want) {
      fails++;
      console.log(`FAIL ${c.word} · ${form}: ${g.kana} ≠ ${want}`);
    }
  }
}
// références acceptées : te_neg doit inclure なくて
const r = conjRefs(conjugateVerb({ word: "飲む", reading: "のむ", group: "godan", isSpecialIku: false, isSpecialAru: false }).te_neg);
if (!r.includes("のまなくて")) { fails++; console.log("FAIL refs te_neg sans なくて :", r.join(",")); }
// furigana
for (const [w, rd, want] of [["飲む", "のむ", "{飲|の}む"], ["食べる", "たべる", "{食|た}べる"], ["勉強する", "べんきょうする", "{勉強|べんきょう}する"], ["ある", "ある", "ある"], ["来る", "くる", "{来|く}る"]] as [string, string, string][]) {
  const got = verbFurigana(w, rd);
  if (got !== want) { fails++; console.log(`FAIL furigana ${w}: ${got} ≠ ${want}`); }
}
console.log(fails === 0 ? "✓ Tous les tests du moteur passent" : `✗ ${fails} échec(s)`);
process.exit(fails ? 1 : 0);
