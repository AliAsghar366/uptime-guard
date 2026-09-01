import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alertSettings, lubricants, sections, taskCurrentState, tasks, units, type TaskStatus } from "@/lib/db/schema";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { scopedUnitIds } from "@/lib/auth/authorize";
import { fileUrl } from "@/lib/storage/supabase";

export interface TaskWithStatus {
  id: string;
  description: string;
  pictureUrl: string | null;
  photoDisplayUrl: string | null;
  markerX: number | null;
  markerY: number | null;
  isCritical: boolean;
  noOfPoints: number;
  lubricationPoints: number;
  frequencyLabel: string;
  frequencyDays: number;
  lubricantName: string | null;
  sectionId: string;
  sectionCode: string;
  sectionName: string | null;
  unitId: string;
  unitCode: string;
  unitName: string;
  currentStatus: TaskStatus | null;
  nextDueAt: string | null;
  lastChangedAt: string | null;
  leadTimeDays: number;
  escalationDays: number;
}

export async function getTasksWithStatus(): Promise<TaskWithStatus[]> {
  const actor = await getCurrentProfile();
  if (!actor) return [];

  // Replaces RLS: units/sections/tasks were transparently filtered to the caller's assigned
  // units before, so this explicit scope filter is what stands in its place now.
  const scope = await scopedUnitIds(actor);
  if (scope !== "all" && scope.length === 0) return [];

  const [rows, settingsRows] = await Promise.all([
    db
      .select({
        id: tasks.id,
        description: tasks.description,
        pictureUrl: tasks.pictureUrl,
        markerX: tasks.pictureMarkerX,
        markerY: tasks.pictureMarkerY,
        isCritical: tasks.isCritical,
        noOfPoints: tasks.noOfPoints,
        lubricationPoints: tasks.lubricationPoints,
        frequencyLabel: tasks.frequencyLabel,
        frequencyDays: tasks.frequencyDays,
        lubricantName: lubricants.name,
        sectionId: sections.id,
        sectionCode: sections.code,
        sectionName: sections.name,
        unitId: units.id,
        unitCode: units.code,
        unitName: units.name,
        currentStatus: taskCurrentState.status,
        nextDueAt: taskCurrentState.nextDueAt,
        lastChangedAt: taskCurrentState.lastChangedAt,
      })
      .from(tasks)
      .innerJoin(sections, eq(sections.id, tasks.sectionId))
      .innerJoin(units, eq(units.id, sections.unitId))
      .leftJoin(lubricants, eq(lubricants.id, tasks.lubricantId))
      .leftJoin(taskCurrentState, eq(taskCurrentState.taskId, tasks.id))
      .where(scope === "all" ? isNull(tasks.archivedAt) : and(isNull(tasks.archivedAt), inArray(units.id, scope))),
    db
      .select({ taskId: alertSettings.taskId, leadTimeDays: alertSettings.leadTimeDays, escalationDays: alertSettings.escalationDays })
      .from(alertSettings),
  ]);

  const globalDefault = settingsRows.find((s) => s.taskId === null) ?? { leadTimeDays: 2, escalationDays: 2 };
  const overrides = new Map(settingsRows.filter((s) => s.taskId !== null).map((s) => [s.taskId as string, s]));

  return rows.map((t) => {
    const override = overrides.get(t.id);
    return {
      id: t.id,
      description: t.description,
      pictureUrl: t.pictureUrl,
      photoDisplayUrl: t.pictureUrl ? fileUrl("reference-photos", t.pictureUrl) : null,
      markerX: t.markerX,
      markerY: t.markerY,
      isCritical: t.isCritical,
      noOfPoints: t.noOfPoints,
      lubricationPoints: t.lubricationPoints,
      frequencyLabel: t.frequencyLabel,
      frequencyDays: t.frequencyDays,
      lubricantName: t.lubricantName,
      sectionId: t.sectionId,
      sectionCode: t.sectionCode,
      sectionName: t.sectionName,
      unitId: t.unitId,
      unitCode: t.unitCode,
      unitName: t.unitName,
      currentStatus: t.currentStatus,
      nextDueAt: t.nextDueAt ? t.nextDueAt.toISOString() : null,
      lastChangedAt: t.lastChangedAt ? t.lastChangedAt.toISOString() : null,
      leadTimeDays: override?.leadTimeDays ?? globalDefault.leadTimeDays,
      escalationDays: override?.escalationDays ?? globalDefault.escalationDays,
    };
  });
}