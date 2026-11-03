import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createDb(): PrismaClient {
  // Mode hébergé (ex. Vercel + Turso) : la progression SM-2 est écrite au
  // runtime, or SQLite fichier est impossible sur un filesystem éphémère.
  // Si TURSO_DATABASE_URL est défini, on passe par l'adapter libSQL distant.
  if (process.env.TURSO_DATABASE_URL) {
    const adapter = new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    return new PrismaClient({ adapter, log: ['error', 'warn'] })
  }
  // Mode local (développement) : SQLite fichier via DATABASE_URL (.env).
  return new PrismaClient({ log: ['error', 'warn'] })
}

export const db =
  globalForPrisma.prisma ?? createDb()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db