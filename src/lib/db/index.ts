import type { Db } from "./client";

export { db, type Db } from "./client";
export * as schema from "./schema";

/**
 * A Drizzle executor: either the root `db` or a transaction handle. Helpers that may run
 * standalone OR inside `db.transaction(...)` accept this so the same code path works for both.
 */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Executor = Db | Tx;
