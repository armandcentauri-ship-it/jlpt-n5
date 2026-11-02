# SPEC — Réécriture des phrases japonaises N5, style Duolingo

## Mission
Tu rewrites des phrases d'exemple japonaises (niveau JLPT N5, app d'apprentissage).
Les phrases actuelles proviennent d'un corpus trop difficile (grammaire N4/N3, contexte exotique).
Tu produis des phrases NOUVELLES, ultra-simples, dans le style Duolingo :
courtes, concrètes, du quotidien, avec un casting récurrent.

## Règles de grammaire — LISTE BLANCHE stricte (tout le reste est INTERDIT)
- Formes verbales : ます / ません / ました / ませんでした / ましょう (rare) / ください / ています (progressif, OK) / たいです (rare)
- Particules : は が を に で へ と も か や から まで の (possession) ね よ
- Copule : です / じゃありません
- Adjectifs : い-adj + です / な-adj + です / forme passée でした・かったです (rare)
- Questions simples : 何 だれ どこ いつ いくら どうして + か
- あります / います ; compteurs simples : ~つ ~人 ~本 ~枚 ~冊 ~匹 ~台 ~個 ~杯 ~歳 ~時 ~分 ~日 ~曜日 ~月
- Possession avec の : 私の本

## INTERDITS absolus (grammaire N4+) — la phrase sera rejetée sinon
より/ほうが (comparatif), たら/れば/なら (conditionnel), なければ/ないと (obligation),
potentiel (られる/えます…), passif, causatif (させる), てくれる/てあげる/てもらう/ていただく,
てしまう/ちゃう, ておく, たり, 〜に来ます/〜に行きます (verbe de but), relative (verbe plain + nom),
つもり/はず, と思います, から/ので (cause inter-propositions), けど/けれど/しかし (2 propositions),
ずつ, ごとに, 毎週, quotes «…» de discours rapporté, nikashi/chains de 3+ て/で, 上手/下手 + が,
いちばん/たくさん/あまり (garder seulement si la phrase reste ultra courte et claire).

## Vocabulaire autorisé
- N5 courant + LE MOT CIBLE (obligatoirement, voir ci-dessous)
- Noms du quotidien : 学校 家 車 水 お茶 コーヒー 猫 犬 本 ペン りんご パン 肉 魚 野菜 お金 電話 駅 人 子ども 友だち 先生 机 いす 窓 部屋 かばん 服 靴 新聞 写真 音楽 映画 病院 店 郵便局 机场→空港 バス でんしゃ テレビ カメラ プレゼント ごはん 朝ごはん 昼ごはん 晩ごはん おちゃ→(déjà listé)
- Casting récurrent : 私 田中さん トムさん メアリーさん 李さん 兄 姉 母 父 先生 友だち 子ども 犬 猫
- Temps : 今日 明日 昨日 毎日 今 朝 夜 昼 7時 月曜日 日曜日 週末 (毎週 interdit, écrire 毎日月曜日 est interdit aussi)
- Lieux : ここ そこ あそこ 学校 家 駅 公園 海 山
- Chiffres : en chiffres arabes (3, 7, 10…). Ex : りんごを3つください。/ 9時に起きます。

## Style Duolingo
- Longueur cible : 6 à 14 caractères (exJa SANS le 。final). MAX absolu : 18.
- Une seule proposition. Affirmatif surtout, quelques négatifs/passés/questions.
- Concret, quotidien, un peu répétitif (c'est voulu, c'est le style Duolingo).
- Pas de culture exotique, pas de noms étrangers hors casting, pas de contexte improbable.
- Ponctuation : terminer par 。, question par か。 Jamais de ! dans exJa.

## Position du mot cible
- Chaque groupe a 1+ mots cibles (champ "words"). La phrase DOIT contenir CHAQUE mot cible.
- La forme peut être conjuguée naturellement (行く → 行きます) MAIS la base du mot doit rester
  identifiable : idéalement le mot apparaît tel quel en sous-chaîne de exJa
  (ex. 買う → 買います contient 買い ; préférer 買います ok, mais pour 青い → 青いです contient 青い).
- Pour les particules (は, を, で…) : phrase naturelle où la particule joue son rôle.
- Pour les interjections (ありがとう, はい, いいえ, いただきます, さようなら, すみません…) :
  mini-échange naturaliste très court. Ex : プレゼント、ありがとう。
- Si 2 mots cibles ne peuvent PAS cohabiter naturellement dans UNE seule phrase courte,
  DÉCOUPE le groupe : produis une entrée par mot, chaque entrée avec ses propres wids.
  Ex : groupe [あちら, あっち] → 2 entrées distinctes.

## Format de sortie (fichier Python obligatoire)
Écris un fichier `scripts/rewrite/batch_N.py` (N = ton numéro) contenant :

```python
# -*- coding: utf-8 -*-
NEW = [
  {
    "wids": [20, 24],                     # TOUS les wid de ton slice doivent être couverts, exactement une fois
    "exJa": "このペンは青いです。",
    "exKana": "このペンはあおいです。",
    "exFurigana": "このペンは{青|あお}いです。",
    "exFr": "Ce stylo est bleu.",
  },
  ...
]
```

## Règles exKana / exFurigana (VÉRIFIÉES MÉCANIQUEMENT — zéro tolérance)
- exKana = exJa avec CHAQUE kanji remplacé par sa lecture en hiragana ; katakana INCHANGÉ ;
  chiffres arabes INCHANGÉS ; ponctuation conservée à l'identique.
- exFurigana = exJa avec chaque segment de kanjis consécutifs annoté {kanjis|lecture hiragana} ;
  tout le reste identique à exJa. Si exJa n'a AUCUN kanji, exFurigana = exJa tel quel.
- Cohérence : en remplaçant dans exFurigana chaque {X|y} par X on doit retrouver exJa EXACTEMENT,
  et en remplaçant chaque {X|y} par y on doit retrouver exKana EXACTEMENT.
- Lectures :使用 la lecture courante N5 (訓読み sauf mots d'origine sino-japonaise).
  Verbes : 買います → {買|か}います. 食べます → {食|た}べます. Multi-kanji : {東京|とうきょう}.

## Règles exFr (français impeccable)
- Traduction naturelle et EXACTE de la phrase (pas une adaptation libre).
- Typographie : espace avant ? et ! ; capitales accentuées (É) ; pas de fautes.
- Si le mot cible est ambigu, choisis le sens le plus courant/du quotidien.
- Pas de guillemets anglais, pas d'anglicismes ("tulips" → "tulipes").

## Auto-contrôle AVANT de finir (obligatoire)
Exécute ce contrôle avec le numéro de ton batch et corrige jusqu'à 0 erreur :
```bash
cd /home/z/my-project && python3 scripts/rewrite/check_batch.py N
```
Il vérifie : couverture exacte des wids du slice N, patterns interdits, longueur ≤ 18,
coherence exFurigana↔exJa↔exKana, présence du mot cible (ou lecture) dans exKana.
Le script affiche les erreurs ligne par ligne — corrige batch_N.py jusqu'à « ALL OK ».
Ne modifie JAMAIS check_batch.py ni slice_N.json.

## Contenu interdit dans exFr
Pas de point d'exclamation dans les traductions de phrases déclaratives (ok pour les interjections).
Pas de « s'il vous plaît » superflu. Traduction fidèle et scolaire, comme Duolingo FR.
