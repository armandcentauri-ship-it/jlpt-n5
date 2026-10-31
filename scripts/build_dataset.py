#!/usr/bin/env python3
"""Build the app datasets: kanji (N5+N4) and vocabulary (~1050 words).

Sources:
  - kanjikana.com N4 list (170 kanji, sens FR) -> data/src/kanjikana_n4.json
  - KANJIDIC2 index  (/tmp/work/kanjidic.json)
  - JMdict index     (/tmp/work/jmdict.json)
  - OpenJLPT vocab/kanji n5+n4 (CC BY-SA 4.0)

Outputs (data/):
  kanji.json, words.json, llm_todo.json
"""
import json
import os
import re
import sys

PROJ = "/home/z/my-project"
OJ = "/tmp/datasrc/OpenJLPT"
TARGET_TOTAL = 1054  # Tango N5 = 1050 mots

def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)

kanjidic = load("/tmp/work/kanjidic.json")
jmdict = load("/tmp/work/jmdict.json")
kanjikana_n4 = load(f"{PROJ}/data/src/kanjikana_n4.json")
oj_kanji_n5 = load(f"{OJ}/data/json/kanji/n5.json")
oj_kanji_n4 = load(f"{OJ}/data/json/kanji/n4.json")
oj_vocab_n5 = load(f"{OJ}/data/json/vocab/n5.json")
oj_vocab_n4 = load(f"{OJ}/data/json/vocab/n4.json")

# ---------------------------------------------------------------- kanji
oj_kanji_by_char = {k["character"]: k for k in oj_kanji_n5 + oj_kanji_n4}
kk_chars = {c for c, _ in kanjikana_n4}
kk_fr = dict(kanjikana_n4)
print(f"kanjikana N4: {len(kk_chars)} kanji | OpenJLPT N4 kanji: {len(oj_kanji_n4)}")
print("diff kanjikana - openjlpt:", sorted(kk_chars - set(oj_kanji_by_char)))
print("diff openjlpt - kanjikana:", sorted(set(oj_kanji_by_char) - kk_chars - {k['character'] for k in oj_kanji_n5})[:20])

kanji_out = []
llm_meanings = []  # {type:"kanji"|"word", key, en}

# N4 = liste kanjikana (le jeu visé par l'utilisateur)
for ch, kk_fr_meaning in kanjikana_n4:
    kd = kanjidic.get(ch, {})
    oj = oj_kanji_by_char.get(ch, {})
    fre = [m for m in kd.get("fre", []) if m and m.lower() != kk_fr_meaning.lower()]
    meanings_fr = [kk_fr_meaning] + fre[:3] if kk_fr_meaning else fre[:4]
    if not meanings_fr:
        meanings_fr = []
        llm_meanings.append({"type": "kanji", "key": ch,
                             "en": "; ".join(kd.get("eng", []) or oj.get("meanings", [])) or ch})
    kanji_out.append({
        "character": ch,
        "level": "N4",
        "onyomi": kd.get("on") or oj.get("onyomi", []),
        "kunyomi": kd.get("kun") or oj.get("kunyomi", []),
        "strokes": kd.get("strokes") or oj.get("strokes"),
        "meaningsFr": meanings_fr,
        "meaningsEn": kd.get("eng") or oj.get("meanings", []),
    })

# N5 = liste officielle (KANJIDIC2 jlpt=4), sans doublon du jeu N4
n5_chars = sorted([c for c, v in kanjidic.items() if v["jlpt"] == "4" and c not in kk_chars])
print(f"N5 kanji (KANJIDIC2): {len(n5_chars)}")
for ch in n5_chars:
    kd = kanjidic[ch]
    oj = oj_kanji_by_char.get(ch, {})
    meanings_fr = kd.get("fre", [])[:4]
    if not meanings_fr:
        llm_meanings.append({"type": "kanji", "key": ch,
                             "en": "; ".join(kd.get("eng", []) or oj.get("meanings", [])) or ch})
    kanji_out.append({
        "character": ch,
        "level": "N5",
        "onyomi": kd.get("on") or oj.get("onyomi", []),
        "kunyomi": kd.get("kun") or oj.get("kunyomi", []),
        "strokes": kd.get("strokes") or oj.get("strokes"),
        "meaningsFr": meanings_fr,
        "meaningsEn": kd.get("eng") or oj.get("meanings", []),
    })

kanji_out.sort(key=lambda k: (k["level"], k["character"]))
print(f"kanji total: {len(kanji_out)}")

# ---------------------------------------------------------------- vocab
def word_fr(entry):
    jd = jmdict.get(str(entry.get("jmdict_id")))
    if jd and jd["fre"]:
        return "; ".join(g for g in jd["fre"][:3] if g)
    return None

seen_keys = set()
seen_ids = set()
words_out = []
llm_sentences = []  # {wid, ja, en, missing:bool}
no_example = []

def add_word(e, level):
    wid = len(words_out)
    meaning_fr = word_fr(e)
    en = "; ".join(e.get("meanings", []))
    if not meaning_fr:
        llm_meanings.append({"type": "word", "key": f"{e['word']}::{e['reading']}", "en": en})
    ex = (e.get("examples") or [None])[0]
    rec = {
        "wid": wid,
        "word": e["word"],
        "reading": e["reading"],
        "romaji": e.get("romaji", ""),
        "level": level,
        "pos": e.get("pos", []),
        "meaningFr": meaning_fr or "",
        "meaningEn": en,
        "jmdictId": str(e.get("jmdict_id") or ""),
        "prio": (jmdict.get(str(e.get("jmdict_id"))) or {}).get("prio", 99),
        "exJa": (ex.get("ja") if ex else "") or "",
        "exFurigana": (ex.get("furigana") if ex else "") or "",
        "exEn": ex.get("en", "") if ex else "",
        "exFr": "",  # rempli par le LLM
    }
    if not ex or not ex.get("ja"):
        no_example.append(rec["wid"])
    elif not ex.get("en"):
        llm_sentences.append({"wid": wid, "ja": rec["exJa"], "en": ""})
    else:
        llm_sentences.append({"wid": wid, "ja": rec["exJa"], "en": rec["exEn"]})
    words_out.append(rec)
    seen_keys.add((e["word"], e["reading"]))
    if e.get("jmdict_id"):
        seen_ids.add(str(e["jmdict_id"]))

for e in oj_vocab_n5:
    add_word(e, "N5")
print(f"vocab N5: {len(words_out)}")

# top-up N4 trié par fréquence JMdict puis longueur
oj_vocab_n4_sorted = sorted(oj_vocab_n4, key=lambda e: ((jmdict.get(str(e.get("jmdict_id"))) or {}).get("prio", 99), len(e["word"])))
added = 0
for e in oj_vocab_n4_sorted:
    if len(words_out) >= TARGET_TOTAL:
        break
    if str(e.get("jmdict_id")) in seen_ids:
        continue
    if (e["word"], e["reading"]) in seen_keys:
        continue
    add_word(e, "N4")
    added += 1
print(f"vocab N4 ajouté: {added} -> total {len(words_out)}")

# ---------------------------------------------------------------- kanji <- mots
# exemples de kanji = mots du corpus contenant ce kanji
kanji_words = {k["character"]: [] for k in kanji_out}
for w in words_out:
    for ch in w["word"]:
        if ch in kanji_words and len(kanji_words[ch]) < 6:
            kanji_words[ch].append({
                "word": w["word"], "reading": w["reading"],
                "fr": w["meaningFr"], "en": w["meaningEn"],
            })
for k in kanji_out:
    k["examples"] = kanji_words.get(k["character"], [])

# ---------------------------------------------------------------- sorties
os.makedirs(f"{PROJ}/data", exist_ok=True)
with open(f"{PROJ}/data/kanji.json", "w", encoding="utf-8") as f:
    json.dump(kanji_out, f, ensure_ascii=False, indent=1)
with open(f"{PROJ}/data/words.json", "w", encoding="utf-8") as f:
    json.dump(words_out, f, ensure_ascii=False, indent=1)
with open(f"{PROJ}/data/llm_todo.json", "w", encoding="utf-8") as f:
    json.dump({"meanings": llm_meanings, "sentences": llm_sentences, "no_example": no_example}, f, ensure_ascii=False)

n_missing_fr = sum(1 for w in words_out if not w["meaningFr"])
print(f"\nRésumé: {len(kanji_out)} kanji, {len(words_out)} mots")
print(f"  mots sans sens FR (LLM): {n_missing_fr}")
print(f"  phrases à traduire (LLM): {len(llm_sentences)}")
print(f"  mots sans exemple (LLM à générer): {len(no_example)}")
print(f"  kanji sans sens FR (LLM): {sum(1 for k in kanji_out if not k['meaningsFr'])}")
