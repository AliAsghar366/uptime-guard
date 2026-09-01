import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { Clock, AlertOctagon, Siren, PowerOff, type LucideIcon } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { scopedUnitIds } from "@/lib/auth/authorize";
import { db } from "@/lib/db/client";
import { alerts, sections, tasks, units } from "@/lib/db/schema";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TYPE_PILL: Record<string, string> = {
  due_soon: "status-pill--due-soon",
  overdue: "status-pill--overdue",
  critical: "status-pill--critical",
  not_working: "status-pill--critical",
};

const TYPE_ICON: Record<string, LucideIcon> = {
  due_soon: Clock,
  overdue: AlertOctagon,
  critical: Siren,
  not_working: PowerOff,
};

export default async function AlertsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");

  const scope = await scopedUnitIds(profile);
  const rows =
    scope === "all" || scope.length > 0
      ? await db
          .select({
            id: alerts.id,
            type: alerts.type,
            triggeredAt: alerts.triggeredAt,
            resolvedAt: alerts.resolvedAt,
            taskId: tasks.id,
            taskDescription: tasks.description,
            sectionCode: sections.code,
            unitCode: units.code,
          })
          .from(alerts)
          .innerJoin(tasks, eq(tasks.id, alerts.taskId))
          .innerJoin(sections, eq(sections.id, tasks.sectionId))
          .innerJoin(units, eq(units.id, sections.unitId))
          .where(scope === "all" ? undefined : inArray(units.id, scope))
          .orderBy(desc(alerts.triggeredAt))
      : [];

  const alertList = rows.map((r) => ({
    id: r.id,
    type: r.type,
    triggeredAt: r.triggeredAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    task: { id: r.taskId, description: r.taskDescription, section: { code: r.sectionCode, unit: { code: r.unitCode } } },
  }));

  const active = alertList.filter((a) => !a.resolvedAt);
  const resolved = alertList.filter((a) => a.resolvedAt);

  function AlertRow({ alert }: { alert: (typeof alertList)[number] }) {
    const Icon = TYPE_ICON[alert.type] ?? Clock;
    return (
      <Link
        href={`/dashboard/machines/${alert.task.id}`}
        className="glass-input flex flex-wrap items-center justify-between gap-2 p-3 transition-colors hover:bg-white/8"
      >
        <div className="flex items-center gap-2">
          <span className={`status-pill ${TYPE_PILL[alert.type] ?? "status-pill--neutral"}`}>
            <Icon size={12} />
            {alert.type.replace("_", " ")}
          </span>
          <span className="text-sm text-white/80">
            {alert.task.section.unit.code} / {alert.task.section.code} — {alert.task.description}
          </span>
        </div>
        <span className="text-xs text-white/55">
          {formatDateTime(alert.triggeredAt)}
          {alert.resolvedAt ? ` → resolved ${formatDateTime(alert.resolvedAt)}` : ""}
        </span>
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Alerts</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-white/50">Nothing active — everything in scope is on track.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {active.map((a) => (
              <AlertRow key={a.id} alert={a} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
          History ({resolved.length})
        </h2>
        <div className="flex flex-col gap-2">
          {resolved.map((a) => (
            <AlertRow key={a.id} alert={a} />
          ))}
        </div>
      </section>
    </div>
  );
}