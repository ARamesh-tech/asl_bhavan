import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";

/**
 * Singleton Prisma client.
 *
 * Aiven's free PostgreSQL tier allows only a handful of concurrent connections, so:
 *  - exactly ONE pg Pool and ONE PrismaClient exist per Node process
 *    (cached on `globalThis` so Next.js dev hot-reload does not leak clients);
 *  - the pool is capped by DATABASE_POOL_MAX (default 5);
 *  - idle connections are released quickly.
 *
 * Never instantiate PrismaClient anywhere else. Import `prisma` from this module.
 */

type GlobalWithPrisma = typeof globalThis & {
  __aslPrisma?: PrismaClient;
  __aslPgPool?: Pool;
};

const g = globalThis as GlobalWithPrisma;

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // pg connects lazily, so module import (e.g. during `next build`) must not crash;
    // the first real query will fail loudly with a connection error instead.
    console.error("[db] DATABASE_URL is not set — database queries will fail.");
  }
  const max = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "5", 10);
  return new Pool({
    connectionString: connectionString || "postgresql://unset:unset@localhost:5432/unset",
    max: Number.isFinite(max) && max > 0 ? max : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });
}

function createClient(pool: Pool): PrismaClient {
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

const pool = g.__aslPgPool ?? createPool();
export const prisma: PrismaClient = g.__aslPrisma ?? createClient(pool);

if (process.env.NODE_ENV !== "production") {
  g.__aslPgPool = pool;
  g.__aslPrisma = prisma;
}

/**
 * Client type accepted by service functions: either the root client or an interactive
 * transaction client, so services compose inside `prisma.$transaction(async (tx) => ...)`.
 */
export type DbClient = PrismaClient | Prisma.TransactionClient;

export type { PrismaClient };
