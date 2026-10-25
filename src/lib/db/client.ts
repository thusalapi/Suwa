import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Server-only Postgres connection. The connection string comes from DATABASE_URL (local `.env` on
 * the clinic PC; the platform's secrets in production).
 *
 * The client is created on FIRST USE, not at import, so the app builds (e.g. a Docker image)
 * without a database, and a missing DATABASE_URL fails the first query with a clear message. One
 * client is reused across dev hot reloads to avoid exhausting connections.
 */
function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env and configure it.");
  }
  return url;
}

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { _suwaSql?: ReturnType<typeof postgres>; _suwaDb?: DrizzleDb };

function getDb(): DrizzleDb {
  if (!globalForDb._suwaDb) {
    const max = Number(process.env.DATABASE_POOL_MAX) || 10;
    globalForDb._suwaSql ??= postgres(getConnectionString(), { max });
    globalForDb._suwaDb = drizzle(globalForDb._suwaSql, { schema });
  }
  return globalForDb._suwaDb;
}

/** The Drizzle client; connects on first use. */
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
export type Db = DrizzleDb;
