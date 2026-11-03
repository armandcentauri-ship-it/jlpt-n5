// Test de l'adapter Prisma ↔ LibSQL/Turso en local (fichier), sans DATABASE_URL.
// Simule exactement les conditions d'exécution Vercel (mode Turso).
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

delete process.env.DATABASE_URL; // comme sur Vercel : pas de DATABASE_URL

const url = process.env.TURSO_DATABASE_URL || "file:/home/z/my-project/db/custom.db";
console.log("URL:", url.replace(/libsql:\/\//, "libsql://***"));

const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const db = new PrismaClient({ adapter });

const [words, kanji, progress, logs] = await Promise.all([
  db.word.count(),
  db.kanji.count(),
  db.progress.count(),
  db.reviewLog.count(),
]);
console.log(`OK — words: ${words}, kanji: ${kanji}, progress: ${progress}, logs: ${logs}`);

// Test écriture + rollback léger sur ReviewLog (valide le mode écriture)
const probe = await db.reviewLog.create({
  data: { itemType: "word", itemId: "__probe__", mode: "flashcard", grade: 2 },
});
await db.reviewLog.delete({ where: { id: probe.id } });
console.log("Écriture + suppression : OK");

await db.$disconnect();
