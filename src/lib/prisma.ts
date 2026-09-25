import { PrismaClient } from "@prisma/client";

function createPrismaClient() {
  return new PrismaClient();
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

// Los pragmas solo existen en SQLite. En PostgreSQL (Vercel/Neon) esta función
// es un no-op para no romper, así que los ~25 call sites quedan igual.
const isSqlite = (process.env.DATABASE_URL || "").startsWith("file:");

// WAL es persistente a nivel de base de datos; busy_timeout es por conexión.
// Se ejecuta una sola vez por proceso.
let pragmasReady = false;

export async function initPragmas() {
  if (!isSqlite || pragmasReady) return;
  try {
    // journal_mode devuelve una fila → $queryRawUnsafe
    await prisma.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`);
    await prisma.$queryRawUnsafe(`PRAGMA busy_timeout = 5000;`);
    pragmasReady = true;
  } catch (error) {
    console.error("No se pudieron aplicar los pragmas de SQLite:", error);
  }
}

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;