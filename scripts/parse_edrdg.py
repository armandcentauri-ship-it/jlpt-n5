#!/usr/bin/env python3
"""Parse KANJIDIC2 + JMdict (EDRDG) into compact lookup indexes.

Outputs:
  /tmp/work/kanjidic.json    -> {char: {on, kun, strokes, fre, eng, jlpt}}
  /tmp/work/jmdict.json      -> {ent_seq: {fre, eng, prio, keb, reb}}
"""
import gzip
import json
import xml.etree.ElementTree as ET

OUT_DIR = "/tmp/work"

# ---------- KANJIDIC2 ----------
kanji = {}
with gzip.open("/tmp/edrdg/kanjidic2.xml.gz", "rb") as f:
    for event, elem in ET.iterparse(f, events=("end",)):
        if elem.tag != "character":
            continue
        ch = elem.findtext("literal")
        jlpt = elem.find("misc/jlpt")
        jlpt_val = jlpt.text if jlpt is not None and jlpt.text else None
        # keep only old-N5 (4) and old-N4 (3) sets to stay small
        strokes = elem.findtext("misc/stroke_count")
        on = [r.text for r in elem.findall("reading_meaning/rmgroup/reading[@r_type='ja_on']") if r.text]
        kun = [r.text for r in elem.findall("reading_meaning/rmgroup/reading[@r_type='ja_kun']") if r.text]
        fre, eng = [], []
        if elem.find("reading_meaning") is not None:
            for m in elem.findall("reading_meaning/rmgroup/meaning"):
                lang = m.get("m_lang", "en")
                if m.text:
                    (fre if lang == "fre" else eng).append(m.text)
        kanji[ch] = {
            "on": on, "kun": kun,
            "strokes": int(strokes) if strokes else None,
            "fre": fre, "eng": eng,
            "jlpt": jlpt_val,
        }
        elem.clear()

with open(f"{OUT_DIR}/kanjidic.json", "w", encoding="utf-8") as f:
    json.dump(kanji, f, ensure_ascii=False)
print(f"kanjidic2: {len(kanji)} kanji (jlpt3={sum(1 for v in kanji.values() if v['jlpt']=='3')}, jlpt4={sum(1 for v in kanji.values() if v['jlpt']=='4')})")

# ---------- JMdict ----------
# prio ranking: lower = more common
PRIO = {"ichi1": 1, "spec1": 2, "news1": 3, "gai1": 4, "ichi2": 5, "spec2": 6, "news2": 7, "gai2": 8}

def prio_rank(pri_list):
    best = 99
    for p in pri_list:
        if p.startswith("nf") and p[2:].isdigit():
            best = min(best, int(p[2:]) / 100.0)  # nf01 => 0.01 (top)
        else:
            best = min(best, PRIO.get(p, 90))
    return best

jmdict = {}
with gzip.open("/tmp/edrdg/JMdict.gz", "rb") as f:
    for event, elem in ET.iterparse(f, events=("end",)):
        if elem.tag != "entry":
            continue
        seq = elem.findtext("ent_seq")
        kebs = [k.findtext("keb") for k in elem.findall("k_ele") if k.findtext("keb")]
        rebs = [r.findtext("reb") for r in elem.findall("r_ele") if r.findtext("reb")]
        fre, eng, pris = [], [], []
        for sense in elem.findall("sense"):
            for g in sense.findall("gloss"):
                lang = g.get("{http://www.w3.org/XML/1998/namespace}lang", "eng")
                if g.text:
                    (fre if lang == "fre" else eng).append(g.text)
            for p in sense.findall("pri"):
                if p.text:
                    pris.append(p.text)
        jmdict[seq] = {
            "fre": fre, "eng": eng,
            "prio": prio_rank(pris),
            "keb": kebs[0] if kebs else None,
            "reb": rebs[0] if rebs else None,
        }
        elem.clear()

with open(f"{OUT_DIR}/jmdict.json", "w", encoding="utf-8") as f:
    json.dump(jmdict, f, ensure_ascii=False)
n_fre = sum(1 for v in jmdict.values() if v["fre"])
print(f"jmdict: {len(jmdict)} entrées ({n_fre} avec glosses FR)")
