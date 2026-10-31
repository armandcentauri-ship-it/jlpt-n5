#!/usr/bin/env node
/* Met à jour la base EN PLACE (sans supprimer de lignes → préserve Progress)
 * avec les métadonnées pédagogiques de data/*.json :
 *   - Word : theme, orderIdx, exTier
 *   - Kanji : grade, orderIdx
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const DATA = '/home/z/my-project/data';
const db = new PrismaClient();
const load = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const words = load(`${DATA}/words.json`);
const kanji = load(`${DATA}/kanji.json`);

let wN = 0;
for (const w of words) {
  await db.word.update({
    where: { wid: w.wid },
    data: { theme: w.theme, orderIdx: w.orderIdx, exTier: w.exTier },
  });
  wN++;
}

let kN = 0;
for (const k of kanji) {
  await db.kanji.update({
    where: { character: k.character },
    data: { grade: k.grade, orderIdx: k.orderIdx },
  });
  kN++;
}

console.log(`OK : ${wN} mots, ${kN} kanji mis à jour (progression préservée).`);
await db.$disconnect();
