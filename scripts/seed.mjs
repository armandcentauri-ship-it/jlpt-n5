#!/usr/bin/env node
/* Seed de la base : kanji + mots depuis data/*.json (idempotent). */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const DATA = '/home/z/my-project/data';
const db = new PrismaClient();
const load = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const dedupeList = (s) => {
  const seen = new Set();
  return s.filter((x) => (x && !seen.has(x.toLowerCase()) ? (seen.add(x.toLowerCase()), true) : false));
};

const kanji = load(`${DATA}/kanji.json`);
const words = load(`${DATA}/words.json`);

await db.reviewLog.deleteMany({});
await db.progress.deleteMany({});
await db.kanji.deleteMany({});
await db.word.deleteMany({});

for (const k of kanji) {
  await db.kanji.create({
    data: {
      character: k.character,
      level: k.level,
      grade: k.grade || 0,
      orderIdx: k.orderIdx || 0,
      onyomi: (k.onyomi || []).join('、'),
      kunyomi: (k.kunyomi || []).join('、'),
      strokes: k.strokes || 0,
      meaningsFr: JSON.stringify(dedupeList(k.meaningsFr || [])),
      meaningsEn: JSON.stringify(dedupeList(k.meaningsEn || [])),
      examples: JSON.stringify(k.examples || []),
    },
  });
}

for (const w of words) {
  await db.word.create({
    data: {
      wid: w.wid,
      word: w.word,
      reading: w.reading,
      romaji: w.romaji || '',
      level: w.level,
      pos: JSON.stringify(w.pos || []),
      meaningFr: dedupeList((w.meaningFr || '').split(';').map((s) => s.trim())).join('; '),
      meaningEn: w.meaningEn || '',
      theme: w.theme || '',
      orderIdx: w.orderIdx || 0,
      exJa: w.exJa || '',
      exKana: w.exKana || '',
      exFurigana: w.exFurigana || '',
      exFr: w.exFr || '',
      exDif: w.exDif || 'avance',
      exTier: w.exTier || 2,
    },
  });
}

const [nK, nW] = [await db.kanji.count(), await db.word.count()];
console.log(`Seed OK: ${nK} kanji, ${nW} mots`);
await db.$disconnect();
