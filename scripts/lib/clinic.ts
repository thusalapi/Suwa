/**
 * Shared clinic selection for the seed scripts, so they work on a database holding several
 * clinics (hosted production): `--clinic "<name or id>"` picks one; without it, the only clinic is
 * used, and the script stops with the list when there are several.
 */
import { asc } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { clinics } from "../../src/lib/db/schema";

/** The value after a `--flag` on the command line. */
export function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Choose the target clinic from `--clinic` (name, case-insensitive, or id) or the only clinic. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function pickClinic(db: PostgresJsDatabase<any>): Promise<{ id: string; name: string }> {
  const all = await db.select({ id: clinics.id, name: clinics.name }).from(clinics).orderBy(asc(clinics.name));
  if (all.length === 0) throw new Error("No clinic found — run `npm run seed:owner` (or `clinic:create`) first.");

  const wanted = arg("--clinic")?.trim();
  if (wanted) {
    const match = UUID.test(wanted)
      ? all.find((c) => c.id === wanted)
      : all.find((c) => c.name.toLowerCase() === wanted.toLowerCase());
    if (!match) throw new Error(`No clinic "${wanted}". Clinics: ${all.map((c) => `"${c.name}"`).join(", ")}`);
    return match;
  }

  if (all.length > 1) {
    throw new Error(
      `This database has ${all.length} clinics — choose one with --clinic "<name>": ${all
        .map((c) => `"${c.name}"`)
        .join(", ")}`,
    );
  }
  return all[0];
}
