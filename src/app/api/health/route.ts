import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Health check for uptime monitoring and container health checks: 200 when the app is up and the
 * database answers, 503 otherwise. Public (outside the login gate), returns no data.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { status: "error", database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
