import { db } from "@/lib/db/client";
import { activityLog } from "@/lib/db/schema";
import type { CurrentProfile } from "@/lib/auth/current-profile";

// db.transaction()'s callback receives a `tx` object that supports the same insert/select/etc.
// query-builder methods as `db` but isn't the same TS type (no $client) -- accept either so
// call sites can log atomically inside a transaction or standalone.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

/** Explicit replacement for the old generic Postgres audit trigger (log_activity()), which
 *  can't be ported to MySQL as a single generic function -- call this at each mutation site
 *  instead. Pass `tx` (not `db`) when logging inside a transaction so the log entry commits
 *  atomically with the write it describes. `actor` is null only for system-initiated writes
 *  (e.g. the alert sweep). */
export async function logActivity(
  executor: Executor,
  actor: CurrentProfile | null,
  action: "insert" | "update",
  tableName: string,
  recordId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
) {
  await executor.insert(activityLog).values({
    actorId: actor?.id ?? null,
    action,
    tableName,
    recordId,
    beforeData: before,
    afterData: after,
  });
}