"""Audit de difficulté des phrases 'simple' (mode Phrases) — détecte les phrases trop dures pour N5."""
import sqlite3, re, json, sys

DB = 'db/custom.db'

patterns = {
    "but ~ni kimasu/ikimasu": re.compile(r"(にきます|に来ます|にいきます|に行きます)"),
    "potentiel/causatif/passif": re.compile(r"(られます|されます|させます|[えけげめねべ]ます|り得)"),
    "~tai": re.compile(r"(たいです|たいと|たかった)"),
    "~tari": re.compile(r"(たり|タリ)"),
    "nakereba/nakute wa": re.compile(r"(なければ|なくては|ないと)"),
    "~to omou": re.compile(r"(と思います|と思って|と思い)"),
    "tsumori/hazu": re.compile(r"(つもり|はず)"),
    "hou ga / yori": re.compile(r"(ほうが|の方が|より)"),
    "conditionnel tara/reba/nara": re.compile(r"(たら|れば|なら)"),
    "mais/et (kedo/ga/shikashi)": re.compile(r"(けど|けれど|しかし|それから|だから|でも)"),
    "~te iru": re.compile(r"(ています|でいます|ていました|ていますか|ている)"),
    "te shimau/te oku": re.compile(r"(てしま|ちゃいました|ておき|ときます|でおき)"),
    "mora/ageru/kureru": re.compile(r"(てもら|であげ|てあげ|てくれ|ていただ|てや)"),
    "zutsu/goto/mai-": re.compile(r"(ずつ|ごとに|毎[週日朝晩年月])"),
    "kara/node": re.compile(r"(から、|ので)"),
    "suki/kirai ga": re.compile(r"(がすき|がきらい|が好き|が嫌い)"),
    "jouzu/heta ga": re.compile(r"(がじょうず|がへた|が上手|が下手)"),
    "ichiban/takusan": re.compile(r"(いちばん|一番|たくさん|あまり)"),
    "compteurs + mo": re.compile(r"([人つ枚本匹回冊台個冊]も)"),
    "~mae/ato": re.compile(r"(前に|後で)"),
}

def audit(only_simple=True):
    db = sqlite3.connect(DB)
    q = "SELECT wid, word, reading, level, exJa, exKana, exFurigana, exFr, exDif, exTier FROM Word WHERE exJa != ''" + (" AND exDif='simple'" if only_simple else "") + " ORDER BY wid"
    rows = db.execute(q).fetchall()
    stats, hard = {}, []
    for wid, word, reading, level, exJa, exKana, exFur, exFr, dif, tier in rows:
        reasons = []
        for name, pat in patterns.items():
            if pat.search(exJa):
                reasons.append(name)
                stats[name] = stats.get(name, 0) + 1
        if len(re.findall(r"[てで]", exJa)) >= 3:
            reasons.append("chaîne て/で (3+)")
            stats["chaîne て/で (3+)"] = stats.get("chaîne て/で (3+)", 0) + 1
        if len(exJa) > 20:
            reasons.append(f"long({len(exJa)})")
            stats["long>20"] = stats.get("long>20", 0) + 1
        if level == "N4":
            reasons.append("mot N4")
            stats["mot N4"] = stats.get("mot N4", 0) + 1
        if reasons:
            hard.append(dict(wid=wid, word=word, reading=reading, level=level, tier=tier,
                             exJa=exJa, exKana=exKana, exFurigana=exFur, exFr=exFr, reasons=reasons))
    print(f"=== Audit {'simple ' if only_simple else 'ALL '}{len(rows)} phrases — dures: {len(hard)} ===")
    for k, v in sorted(stats.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")
    return hard

if __name__ == "__main__":
    hard = audit()
    json.dump(hard, open("/tmp/hard_sentences.json", "w"), ensure_ascii=False, indent=1)
    print("\nDétail dans /tmp/hard_sentences.json")
