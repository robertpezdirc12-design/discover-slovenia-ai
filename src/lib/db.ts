import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// P0 AUDIT M6: query-dnevnik SAMO v razvoju — v produkciji bi vezani parametri
// (e-pošte, vsebina spomina, sporočila poti) pristali v stdout/server.log.
// V produkciji ostanejo samo napake (errors), brez poizvedbenega prometa.
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db