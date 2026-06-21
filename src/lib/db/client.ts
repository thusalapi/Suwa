import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Server-only Postgres connection (local install on the clinic PC). The connection string
 * comes from DATABASE_URL in the local .env. A single client is reused across dev hot
 * reloads to avoid exhausting connections.
 */
function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env and configure it.");
  }
  return url;
}

const globalForDb = globalThis as unknown as { _suwaSql?: ReturnType<typeof postgres> };

const client = globalForDb._suwaSql ?? postgres(getConnectionString(), { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb._suwaSql = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
