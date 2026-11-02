"""Audit de difficulté des phrases 'simple' (mode Phrases) — détecte les phrases trop dures pour N5.
Aligné sur scripts/rewrite/SPEC.md : ています progressif, 好きです, 毎日/毎月/毎晩, あまり (court),
destination + に行きます (大学に行きます) et les mots contenant なら/たら/たり (新しい, 習う,
働く, 二人, 必ず, 並ぶ, さようなら) sont AUTORISÉS. 'mot N4' reste indicatif (le mot cible
peut être N4 ; la phrase elle-même doit rester simple).
"""
import sqlite3, re, json, sys

DB = 'db/custom.db'

# faux positifs lexicalisés : mots N5 légitimes à retirer avant recherche (cf. check_batch.py)
FP_OK = re.compile(r"(あたらしい|あたらしく|はたら|かならず|さようなら|ならう|ならいま|ならべ|ならぶ|ふたり)")

patterns = {
    "but ~ni kimasu/ikimasu": re.compile(r"[きぎしちりぴびみひけげせてでめねべ]に(行きます|来ます|いきます|きます)"),
    "potentiel/causatif/passif": re.compile(r"(られます|されます|させます|り得)"),
    "~tai": re.compile(r"(たいです|たいと|たかった)"),
    "~tari": re.compile(r"(たり|タリ)"),
    "nakereba/nakute wa": re.compile(r"(なければ|なくては|ないと)"),
    "~to omou": re.compile(r"(と思います|と思って|と思い)"),
    "tsumori/hazu": re.compile(r"(つもり|はず)"),
    "hou ga / yori": re.compile(r"(ほうが|の方が|より)"),
    "conditionnel tara/reba/nara": re.compile(r"(たら|れば|なら)"),
    "mais/et (kedo/ga/shikashi)": re.compile(r"(けど|けれど|しかし|それから|だから)"),
    "te shimau/te oku": re.compile(r"(てしま|ちゃいました|ておき|ときます|でおき)"),
    "mora/ageru/kureru": re.compile(r"(てもら|であげ|てあげ|てくれ|ていただ|てや)"),
    "zutsu/goto/mai-": re.compile(r"(ずつ|ごとに|毎週)"),
    "kara/node": re.compile(r"(から、|ので)"),
    "jouzu/heta ga": re.compile(r"(がじょうず|がへた|が上手|が下手)"),
}

def audit(only_simple=True):
    db = sqlite3.connect(DB)
    q = "SELECT wid, word, reading, level, exJa, exKana, exFurigana, exFr, exDif, exTier FROM Word WHERE exJa != ''" + (" AND exDif='simple'" if only_simple else "") + " ORDER BY wid"
    rows = db.execute(q).fetchall()
    stats, hard = {}, []
    for wid, word, reading, level, exJa, exKana, exFur, exFr, dif, tier in rows:
        reasons = []
        ja_clean = FP_OK.sub("", exJa)
        for name, pat in patterns.items():
            if pat.search(ja_clean):
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
