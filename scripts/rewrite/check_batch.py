# -*- coding: utf-8 -*-
"""Vérification mécanique d'un batch de phrases réécrites.
Usage : python3 scripts/rewrite/check_batch.py <N>
Vérifie (d'après scripts/rewrite/batch_N.py vs scripts/rewrite/slice_N.json) :
  1. couverture exacte des wids (chaque wid du slice, exactement une fois)
  2. cohérence exFurigana -> exJa (kanji) et -> exKana (lectures)
  3. grammaire interdite N4+, longueur max, caractères parasites
  4. mot cible (ou sa lecture) présent dans exKana
"""
import sys, re, json, importlib.util, unicodedata

ROOT = "/home/z/my-project/scripts/rewrite"
# radicaux de verbes (godan colonne い + ichidan ligne え) servant à détecter
# la forme de but 〜に行きます (ex. 買いに行きます) sans flagger 学校に行きます
STEM = "きぎしちりぴびみひけげせてでめねべ"
BAN_PATTERNS = [
    ("comparatif より/ほうが", re.compile(r"(より|ほうが|方が)")),
    ("conditionnel たら/れば/なら", re.compile(r"(たら|れば|なら)")),
    ("obligation なければ", re.compile(r"(なければ|なくては|ないと|なきゃ)")),
    ("passif/potentiel られます", re.compile(r"られます")),
    ("causatif させます", re.compile(r"させます")),
    ("cadeau てくれる/あげる/もらう", re.compile(r"(てくれ|でくれ|てあげ|であげ|てもら|でもら|ていただ|いただきます|くださ(?!い))")),
    ("てしまう/ておく", re.compile(r"(てしま|でしま|ちゃいました|ちゃった|ちゃう|ておき|でおき)")),
    ("たり", re.compile(r"たり")),
    ("cause から/ので", re.compile(r"(から、|ので|からです)")),
    ("contraste けど/しかし", re.compile(r"(けど|けれど|しかし|だから|それから)")),
    ("relative ~という/んです", re.compile(r"(という|んです|のです)")),
    ("つもり/はず/と思います", re.compile(r"(つもり|はず|と思います)")),
    ("ずつ/ごとに/毎週", re.compile(r"(ずつ|ごとに|毎週)")),
    ("でしょう/かもしれません/ながら", re.compile(r"(でしょう|でしょうか|かもしれません|ながら)")),
    ("discours rapporté", re.compile(r"[「『]")),
    ("Point d'exclamation", re.compile(r"！")),
    ("lettre latine", re.compile(r"[A-Za-zＡ-Ｚａ-ｚ]")),
]
KANJI_RE = re.compile(r"[\u4e00-\u9fff\u3400-\u4dbf]")
FUR_RE = re.compile(r"\{([^|{}]+)\|([^{}]+)\}")
PUNCT = re.compile(r"[。、！？!?.,，…・〜\-‐–\s\u3000]")

def kata_to_hira(s):
    out = []
    for ch in s:
        code = ord(ch)
        if 0x30A1 <= code <= 0x30F6:
            out.append(chr(code - 0x60))
        else:
            out.append(ch)
    return "".join(out)

def norm(s):
    return PUNCT.sub("", kata_to_hira(unicodedata.normalize("NFKC", s)))

def furigana_plain(f):
    return FUR_RE.sub(lambda m: m.group(1), f)

def furigana_kana(f):
    return FUR_RE.sub(lambda m: m.group(2), f)

def main(n):
    spec = importlib.util.spec_from_file_location("batch", f"{ROOT}/batch_{n}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    NEW = mod.NEW
    slice_data = json.load(open(f"{ROOT}/slice_{n}.json"))
    slice_wids = [w for g in slice_data for w in g["wids"]]
    errors = []
    # 1. couverture
    seen = {}
    for i, e in enumerate(NEW):
        for w in e["wids"]:
            if w in seen:
                errors.append(f"entry{i} wid {w} couvert 2x (déjà entry{seen[w]})")
            seen[w] = i
    missing = [w for w in slice_wids if w not in seen]
    extra = [w for w in seen if w not in slice_wids]
    if missing: errors.append(f"wids manquants: {missing[:20]}")
    if extra: errors.append(f"wids hors slice: {extra[:20]}")
    # 2-4. par entrée
    for i, e in enumerate(NEW):
        wid, ja, ka, fu, fr = e["wids"], e["exJa"], e["exKana"], e["exFurigana"], e["exFr"]
        tag = f"entry{i}(wids={wid})"
        if KANJI_RE.search(ka): errors.append(f"{tag} exKana contient des kanji")
        if furigana_plain(fu) != ja: errors.append(f"{tag} furigana→plain != exJa : [{furigana_plain(fu)}] vs [{ja}]")
        if furigana_kana(fu) != ka: errors.append(f"{tag} furigana→kana != exKana : [{furigana_kana(fu)}] vs [{ka}]")
        body = ja.rstrip("。")
        if len(body) > 18: errors.append(f"{tag} trop long ({len(body)}): {ja}")
        if not body: errors.append(f"{tag} vide")
        for name, pat in BAN_PATTERNS:
            m = pat.search(ja) or pat.search(norm(ka))
            if m: errors.append(f"{tag} interdit[{name}] match '{m.group(0)}': {ja}")
        # forme de but 〜に行きます : détection sur exJa uniquement (radical hiragana + に行きます),
        # pour ne pas flagger 学校に行きます / トイレに行きます (lieu en kanji/katakana)
        m = re.search(rf"[{STEM}い]に(行きます|来ます|きます)", ja)
        if m: errors.append(f"{tag} interdit[but 〜に行きます] match '{m.group(0)}': {ja}")
        if not fr or not fr.strip(): errors.append(f"{tag} exFr vide")
        # mot cible présent
        groups_by_wid = {}
        for g in slice_data:
            for w in g["wids"]:
                groups_by_wid[w] = g
        for w in wid:
            g = groups_by_wid.get(w)
            if not g: continue
            words = g["words"]
            if w not in e["wids"]:
                continue
            # ce wid doit trouver AU MOINS son propre mot dans la phrase
            idx = g["wids"].index(w)
            target = words[idx]
            surface = norm(target["w"])
            reading = norm(target["r"])
            hay = norm(ka)
            ok = surface in hay or reading in hay or (len(reading) > 2 and reading[:-1] in hay) or (len(reading) > 3 and reading[:-2] in hay)
            if not ok:
                errors.append(f"{tag} mot cible absent: {target['w']}[{target['r']}] introuvable dans exKana [{ka}]")
    if errors:
        print(f"batch_{n} : {len(errors)} ERREUR(S)")
        for e in errors: print("  -", e)
        sys.exit(1)
    print(f"ALL OK — batch_{n} : {len(NEW)} entrées couvrant {len(slice_wids)} wids")

if __name__ == "__main__":
    main(int(sys.argv[1]))
