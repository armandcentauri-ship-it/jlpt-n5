# -*- coding: utf-8 -*-
"""Applique les batchs de réécriture Duolingo à la base SQLite.

Pour chaque batch_N.py (validated par check_batch.py) :
  - met à jour exJa/exKana/exFurigana/exFr de chaque wid couvert
  - exDif = 'simple' (inchangé), exTier = tier d'origine du slice (progression conservée)
Backup de la base avant application.
"""
import importlib.util, sqlite3, json, shutil, time, os

ROOT = "/home/z/my-project/scripts/rewrite"
DB = "/home/z/my-project/db/custom.db"

backup = f"{DB}.bak-duolingo-{time.strftime('%Y%m%d-%H%M%S')}"
shutil.copy(DB, backup)
print(f"Backup : {backup}")

db = sqlite3.connect(DB)
total = 0
for n in range(1, 6):
    spec = importlib.util.spec_from_file_location(f"batch_{n}", f"{ROOT}/batch_{n}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    slice_data = json.load(open(f"{ROOT}/slice_{n}.json"))
    tier_by_wid = {}
    for g in slice_data:
        for w, t in zip(g["wids"], g["tiers"]):
            tier_by_wid[w] = t
    for e in mod.NEW:
        for wid in e["wids"]:
            cur = db.execute(
                "UPDATE Word SET exJa=?, exKana=?, exFurigana=?, exFr=?, exDif='simple', exTier=? WHERE wid=?",
                (e["exJa"], e["exKana"], e["exFurigana"], e["exFr"], tier_by_wid.get(wid, 1), wid),
            )
            if cur.rowcount != 1:
                raise SystemExit(f"wid {wid} (batch {n}) : rowcount={cur.rowcount}")
            total += 1
    print(f"batch_{n} : ok ({len(mod.NEW)} entrées)")
db.commit()
print(f"TOTAL : {total} phrases mises à jour")

# Contrôle : la phrase ゴミ signalée par l'utilisateur
for row in db.execute("SELECT wid, word, exJa, exFr FROM Word WHERE wid IN (849, 1052)"):
    print("ゴミ ->", row)
db.close()
