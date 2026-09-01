import { eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alertSettings, alerts, taskCurrentState, tasks, type AlertType } from "@/lib/db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Port of evaluate_task_alerts(): generates due_soon/overdue/critical alerts and auto-resolves
 *  them once a task is working again with no due date or a future one. "not_working" alerts are
 *  untouched here -- those are handled synchronously in src/lib/services/status-events.ts.
 *  Meant to be run on a schedule (see src/app/api/cron/evaluate-alerts/route.ts), not per-request. */
export async function evaluateTaskAlerts() {
  const now = new Date();

  const [globalSettingsRows, overrideRows, workingTasks, openAlerts] = await Promise.all([
    db
      .select({ leadTimeDays: alertSettings.leadTimeDays, escalationDays: alertSettings.escalationDays })
      .from(alertSettings)
      .where(isNull(alertSettings.taskId))
      .limit(1),
    db
      .select({
        taskId: alertSettings.taskId,
        leadTimeDays: alertSettings.leadTimeDays,
        escalationDays: alertSettings.escalationDays,
      })
      .from(alertSettings),
    db
      .select({ taskId: tasks.id, nextDueAt: taskCurrentState.nextDueAt })
      .from(tasks)
      .innerJoin(taskCurrentState, eq(taskCurrentState.taskId, tasks.id))
      .where(eq(taskCurrentState.status, "working")),
    db.select({ id: alerts.id, taskId: alerts.taskId, type: alerts.type }).from(alerts).where(isNull(alerts.resolvedAt)),
  ]);

  const globalDefault = globalSettingsRows[0] ?? { leadTimeDays: 2, escalationDays: 2 };
  const overrideMap = new Map(overrideRows.filter((o) => o.taskId).map((o) => [o.taskId as string, o]));
  const openAlertKey = (taskId: string, type: AlertType) => `${taskId}:${type}`;
  const openAlertMap = new Map(openAlerts.map((a) => [openAlertKey(a.taskId, a.type), a.id]));

  const toInsert: { taskId: string; type: AlertType }[] = [];
  const toResolveIds: string[] = [];

  for (const task of workingTasks) {
    const override = overrideMap.get(task.taskId);
    const leadTimeDays = override?.leadTimeDays ?? globalDefault.leadTimeDays;
    const escalationDays = override?.escalationDays ?? globalDefault.escalationDays;
    const dueMs = task.nextDueAt?.getTime() ?? null;

    if (dueMs !== null) {
      const isDueSoon = now.getTime() >= dueMs - leadTimeDays * DAY_MS && now.getTime() < dueMs;
      const isOverdue = now.getTime() >= dueMs;
      const isCritical = now.getTime() >= dueMs + escalationDays * DAY_MS;

      if (isDueSoon && !openAlertMap.has(openAlertKey(task.taskId, "due_soon"))) {
        toInsert.push({ taskId: task.taskId, type: "due_soon" });
      }
      if (isOverdue && !openAlertMap.has(openAlertKey(task.taskId, "overdue"))) {
        toInsert.push({ taskId: task.taskId, type: "overdue" });
      }
      if (isCritical && !openAlertMap.has(openAlertKey(task.taskId, "critical"))) {
        toInsert.push({ taskId: task.taskId, type: "critical" });
      }
    }

    if (dueMs === null || dueMs > now.getTime()) {
      for (const type of ["due_soon", "overdue", "critical"] as const) {
        const openId = openAlertMap.get(openAlertKey(task.taskId, type));
        if (openId) toResolveIds.push(openId);
      }
    }
  }

  if (toInsert.length > 0) {
    await db
      .insert(alerts)
      .values(toInsert.map((a) => ({ id: crypto.randomUUID(), taskId: a.taskId, type: a.type, triggeredAt: now })));
  }

  if (toResolveIds.length > 0) {
    await db.update(alerts).set({ resolvedAt: now }).where(inArray(alerts.id, toResolveIds));
  }

  return { inserted: toInsert.length, resolved: toResolveIds.length };
}