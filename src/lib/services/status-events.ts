import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alerts, sections, taskCurrentState, taskStatusEvents, tasks, units, type TaskStatus } from "@/lib/db/schema";
import { assertCanRecordStatus, AuthorizationError } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/services/activity-log";
import type { CurrentProfile } from "@/lib/auth/current-profile";

export interface RecordStatusEventInput {
  taskId: string;
  status: TaskStatus;
  comment?: string | null;
  photoUrl?: string | null;
}

/** Records a check-off and, in the same transaction, refreshes task_current_state and fires/
 *  resolves the "not_working" alert -- the MySQL replacement for the old
 *  refresh_task_current_state() and raise_not_working_alert() AFTER INSERT triggers. Returns
 *  the new event's id. */
export async function recordStatusEvent(actor: CurrentProfile, input: RecordStatusEventInput) {
  const taskRows = await db
    .select({ frequencyDays: tasks.frequencyDays, unitId: units.id })
    .from(tasks)
    .innerJoin(sections, eq(sections.id, tasks.sectionId))
    .innerJoin(units, eq(units.id, sections.unitId))
    .where(eq(tasks.id, input.taskId))
    .limit(1);

  const task = taskRows[0];
  // Same generic message whether the task doesn't exist or the caller lacks unit scope --
  // matches the old behavior where an RLS-denied insert and a bad id looked identical.
  if (!task) throw new AuthorizationError("You may not have access to this task.");
  await assertCanRecordStatus(actor, task.unitId);

  const now = new Date();
  const eventId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(taskStatusEvents).values({
      id: eventId,
      taskId: input.taskId,
      status: input.status,
      comment: input.comment ?? null,
      photoUrl: input.photoUrl ?? null,
      recordedBy: actor.id,
      createdAt: now,
    });

    const nextDueAt =
      input.status === "working" ? new Date(now.getTime() + task.frequencyDays * 24 * 60 * 60 * 1000) : null;

    await tx
      .insert(taskCurrentState)
      .values({
        taskId: input.taskId,
        status: input.status,
        lastEventId: eventId,
        lastChangedAt: now,
        nextDueAt,
        updatedAt: now,
      })
      .onDuplicateKeyUpdate({
        set: { status: input.status, lastEventId: eventId, lastChangedAt: now, nextDueAt, updatedAt: now },
      });

    if (input.status === "not_working") {
      await tx.insert(alerts).values({
        id: crypto.randomUUID(),
        taskId: input.taskId,
        type: "not_working",
        triggeredAt: now,
      });
    } else {
      await tx
        .update(alerts)
        .set({ resolvedAt: now, acknowledgedBy: actor.id })
        .where(and(eq(alerts.taskId, input.taskId), eq(alerts.type, "not_working"), isNull(alerts.resolvedAt)));
    }

    await logActivity(tx, actor, "insert", "task_status_events", eventId, null, {
      taskId: input.taskId,
      status: input.status,
      comment: input.comment ?? null,
    });
  });

  return eventId;
}