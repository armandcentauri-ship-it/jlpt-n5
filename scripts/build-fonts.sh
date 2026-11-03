#!/bin/bash
# Self-hosting des fonts : subset woff2 générés depuis google/fonts (OFL).
# - Nunito (variable) : subset latin/latin-ext/ponctuation
# - Zen Kaku Gothic New : subset au corpus de l'app (kana + kanji du contenu)
# Usage : bash scripts/build-fonts.sh   (les TTF sources en /tmp/fonts/)
set -e
cd "$(dirname "$0")/.."
OUT=src/app/fonts
TMP=/tmp/fonts
mkdir -p "$OUT" "$TMP"

DL() { [ -f "$TMP/$1" ] || curl -sL -o "$TMP/$1" "https://raw.githubusercontent.com/google/fonts/main/ofl/$2"; }
DL nunito.ttf        "nunito/Nunito%5Bwght%5D.ttf"
DL zkg-regular.ttf   "zenkakugothicnew/ZenKakuGothicNew-Regular.ttf"
DL zkg-medium.ttf    "zenkakugothicnew/ZenKakuGothicNew-Medium.ttf"
DL zkg-bold.ttf      "zenkakugothicnew/ZenKakuGothicNew-Bold.ttf"

node scripts/font-corpus.mjs > "$TMP/corpus.txt"
echo "Corpus : $(wc -m < "$TMP/corpus.txt") caractères"

# Nunito variable — latin, latin-ext, ponctuation générale, symboles
pyftsubset "$TMP/nunito.ttf" \
  --output-file="$OUT/Nunito-Variable.woff2" --flavor=woff2 --no-hinting \
  --layout-features='*' \
  --unicodes="U+0000-00FF,U+0100-024F,U+0259,U+0300-036F,U+1E00-1EFF,U+2000-206F,U+2070-209F,U+20A0-20CF,U+2122,U+2212,U+2215,U+FEFF"

# Zen Kaku Gothic New — corpus de l'app (kanji réellement utilisés) + kana + ponctuation CJK
ZK_UNI="U+0000-036F,U+2000-206F,U+20A0-20CF,U+2212,U+3000-30FF,U+309B-309C,U+FF00-FF9F,U+FEFF"
for W in Regular Medium Bold; do
  LO=$(echo "$W" | tr 'A-Z' 'a-z')
  pyftsubset "$TMP/zkg-$LO.ttf" \
    --output-file="$OUT/ZenKakuGothicNew-$W.woff2" --flavor=woff2 --no-hinting \
    --layout-features='*' \
    --text-file="$TMP/corpus.txt" \
    --unicodes="$ZK_UNI"
done

ls -lh "$OUT"
