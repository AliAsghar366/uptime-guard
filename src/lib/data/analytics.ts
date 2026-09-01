import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alertSettings, alerts, sections, taskCurrentState, taskStatusEvents, tasks, units } from "@/lib/db/schema";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { scopedUnitIds } from "@/lib/auth/authorize";
import { computeBadge } from "@/lib/status";

export interface AnalyticsData {
  totalTasks: number;
  workingCount: number;
  notWorkingCount: number;
  byUnit: { unitCode: string; onTrack: number; dueSoon: number; overdue: number; critical: number; notWorking: number }[];
  activityByDay: { day: string; checks: number }[];
  alertsByType: { type: string; count: number }[];
}

export async function getAnalytics(): Promise<AnalyticsData> {
  const empty: AnalyticsData = { totalTasks: 0, workingCount: 0, notWorkingCount: 0, byUnit: [], activityByDay: [], alertsByType: [] };

  const actor = await getCurrentProfile();
  if (!actor) return empty;

  const scope = await scopedUnitIds(actor);
  if (scope !== "all" && scope.length === 0) return empty;

  const unitFilter = scope === "all" ? undefined : inArray(units.id, scope);
  const taskIdsScope =
    scope === "all"
      ? undefined
      : db
          .select({ id: tasks.id })
          .from(tasks)
          .innerJoin(sections, eq(sections.id, tasks.sectionId))
          .where(inArray(sections.unitId, scope));

  const [taskRows, settingsRows, eventRows, alertRows] = await Promise.all([
    db
      .select({ id: tasks.id, unitCode: units.code, status: taskCurrentState.status, nextDueAt: taskCurrentState.nextDueAt })
      .from(tasks)
      .innerJoin(sections, eq(sections.id, tasks.sectionId))
      .innerJoin(units, eq(units.id, sections.unitId))
      .leftJoin(taskCurrentState, eq(taskCurrentState.taskId, tasks.id))
      .where(unitFilter ? and(isNull(tasks.archivedAt), unitFilter) : isNull(tasks.archivedAt)),
    db.select({ taskId: alertSettings.taskId, leadTimeDays: alertSettings.leadTimeDays, escalationDays: alertSettings.escalationDays }).from(alertSettings),
    db
      .select({ createdAt: taskStatusEvents.createdAt })
      .from(taskStatusEvents)
      .where(
        taskIdsScope
          ? and(gte(taskStatusEvents.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), inArray(taskStatusEvents.taskId, taskIdsScope))
          : gte(taskStatusEvents.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      ),
    db
      .select({ type: alerts.type })
      .from(alerts)
      .where(taskIdsScope ? inArray(alerts.taskId, taskIdsScope) : undefined),
  ]);

  const globalDefault = settingsRows.find((s) => s.taskId === null) ?? { leadTimeDays: 2, escalationDays: 2 };

  const byUnitMap = new Map<string, { onTrack: number; dueSoon: number; overdue: number; critical: number; notWorking: number }>();
  let workingCount = 0;
  let notWorkingCount = 0;

  for (const row of taskRows) {
    if (!byUnitMap.has(row.unitCode)) {
      byUnitMap.set(row.unitCode, { onTrack: 0, dueSoon: 0, overdue: 0, critical: 0, notWorking: 0 });
    }
    const bucket = byUnitMap.get(row.unitCode)!;

    const badge = computeBadge({
      currentStatus: row.status ?? null,
      nextDueAt: row.nextDueAt ? row.nextDueAt.toISOString() : null,
      leadTimeDays: globalDefault.leadTimeDays,
      escalationDays: globalDefault.escalationDays,
    });

    if (row.status === "not_working") notWorkingCount++;
    else workingCount++;

    if (badge === "not_working") bucket.notWorking++;
    else if (badge === "critical") bucket.critical++;
    else if (badge === "overdue") bucket.overdue++;
    else if (badge === "due_soon") bucket.dueSoon++;
    else bucket.onTrack++;
  }

  const activityMap = new Map<string, number>();
  for (const e of eventRows) {
    const day = e.createdAt.toISOString().slice(0, 10);
    activityMap.set(day, (activityMap.get(day) ?? 0) + 1);
  }
  const activityByDay = [...activityMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, checks]) => ({ day: day.slice(5), checks }));

  const alertsMap = new Map<string, number>();
  for (const a of alertRows) {
    alertsMap.set(a.type, (alertsMap.get(a.type) ?? 0) + 1);
  }

  return {
    totalTasks: taskRows.length,
    workingCount,
    notWorkingCount,
    byUnit: [...byUnitMap.entries()].map(([unitCode, v]) => ({ unitCode, ...v })),
    activityByDay,
    alertsByType: [...alertsMap.entries()].map(([type, count]) => ({ type, count })),
  };
}