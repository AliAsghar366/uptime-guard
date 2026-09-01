import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getCurrentProfile, hasFullVisibility } from "@/lib/auth/current-profile";
import { db } from "@/lib/db/client";
import { activityLog, users } from "@/lib/db/schema";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ActivityLogPage() {
  const profile = await getCurrentProfile();
  if (!profile || !hasFullVisibility(profile.role)) {
    redirect("/dashboard/tasks");
  }

  const rows = await db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      tableName: activityLog.tableName,
      recordId: activityLog.recordId,
      createdAt: activityLog.createdAt,
      actorFullName: users.fullName,
      actorRole: users.role,
    })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.actorId))
    .orderBy(desc(activityLog.createdAt))
    .limit(300);

  const entries = rows.map((r) => ({
    id: r.id,
    action: r.action,
    tableName: r.tableName,
    recordId: r.recordId,
    createdAt: r.createdAt.toISOString(),
    actor: r.actorFullName ? { fullName: r.actorFullName, role: r.actorRole } : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Activity Log</h1>
      <p className="-mt-4 text-xs text-white/40">
        Every insert/update across the system, permanently recorded. Most recent 300 entries.
      </p>

      <div className="glass-panel flex flex-col divide-y divide-white/8">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
            <span className="text-white/80">
              <span className="font-medium">{entry.actor?.fullName ?? "System"}</span>{" "}
              <span className="text-white/40">({entry.actor?.role ?? "—"})</span> {entry.action}d a record in{" "}
              <span className="font-mono text-white/60">{entry.tableName}</span>
            </span>
            <span className="shrink-0 text-white/40">{formatDateTime(entry.createdAt)}</span>
          </div>
        ))}
        {entries.length === 0 ? (
          <p className="px-4 py-6 text-sm text-white/50">No activity recorded yet.</p>
        ) : null}
      </div>
    </div>
  );
}