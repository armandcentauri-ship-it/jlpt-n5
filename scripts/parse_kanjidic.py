#!/usr/bin/env python3
"""Extrait de KANJIDIC2 les sens FR/EN + lectures (ordre = fréquence) pour les
kanji présents dans la DB. Sortie : /tmp/kanjidic_fr.json
{ "一": {"fr": [...], "en": [...], "on": [...], "kun": [...], "grade": 1, "strokes": 1}, ... }
"""
import gzip
import json
import xml.etree.ElementTree as ET

DB_CHARS_PATH = "/tmp/kanji_chars.json"  # rempli par l'étape suivante
OUT = "/tmp/kanjidic_fr.json"
SRC = "/tmp/kanjidic2.xml.gz"

def main():
    import sys
    chars = set(json.load(open(DB_CHARS_PATH)))
    result = {}
    with gzip.open(SRC, "rb") as f:
        for event, elem in ET.iterparse(f, events=("end",)):
            if elem.tag != "character":
                continue
            lit = elem.findtext("literal")
            if lit not in chars:
                elem.clear()
                continue
            grade = int(elem.findtext("grade") or 0)
            strokes = int(elem.findtext("stroke_count") or 0)
            fr, en = [], []
            rm = elem.find("reading_meaning")
            on, kun = [], []
            if rm is not None:
                for rmg in rm.findall("rmgroup"):
                    for m in rmg.findall("meaning"):
                        lang = m.get("m_lang", "en")
                        txt = (m.text or "").strip()
                        if not txt:
                            continue
                        if lang == "fr":
                            fr.append(txt)
                        elif lang == "en":
                            en.append(txt)
                    for r in rmg.findall("reading"):
                        t = (r.text or "").strip()
                        if not t:
                            continue
                        if r.get("r_type") == "ja_on":
                            on.append(t)
                        elif r.get("r_type") == "ja_kun":
                            kun.append(t)
            result[lit] = {"fr": fr, "en": en, "on": on, "kun": kun, "grade": grade, "strokes": strokes}
            elem.clear()
    json.dump(result, open(OUT, "w"), ensure_ascii=False, indent=1)
    print(f"Extraits {len(result)} kanji -> {OUT}")

if __name__ == "__main__":
    main()
