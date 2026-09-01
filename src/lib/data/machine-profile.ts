import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  alerts,
  eventAnnotations,
  lubricants,
  sections,
  taskStatusEvents,
  tasks,
  units,
  users,
  type AlertType,
  type TaskStatus,
} from "@/lib/db/schema";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { hasUnitScope } from "@/lib/auth/authorize";

export interface StatusEvent {
  id: string;
  status: TaskStatus;
  comment: string | null;
  photoUrl: string | null;
  createdAt: string;
  recordedByName: string;
  recordedByRole: string;
  annotations: { id: string; body: string; createdAt: string; authorName: string }[];
}

export interface AlertHistoryEntry {
  id: string;
  type: AlertType;
  triggeredAt: string;
  resolvedAt: string | null;
}

export interface MachineProfile {
  id: string;
  description: string;
  pictureUrl: string | null;
  markerX: number | null;
  markerY: number | null;
  isCritical: boolean;
  noOfPoints: number;
  lubricationPoints: number;
  frequencyLabel: string;
  lubricantName: string | null;
  sectionCode: string;
  unitCode: string;
  unitName: string;
  archivedAt: string | null;
  events: StatusEvent[];
  alerts: AlertHistoryEntry[];
}

export async function getMachineProfile(taskId: string): Promise<MachineProfile | null> {
  const actor = await getCurrentProfile();
  if (!actor) return null;

  const rows = await db
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
      archivedAt: tasks.archivedAt,
      lubricantName: lubricants.name,
      sectionCode: sections.code,
      unitId: units.id,
      unitCode: units.code,
      unitName: units.name,
    })
    .from(tasks)
    .innerJoin(sections, eq(sections.id, tasks.sectionId))
    .innerJoin(units, eq(units.id, sections.unitId))
    .leftJoin(lubricants, eq(lubricants.id, tasks.lubricantId))
    .where(eq(tasks.id, taskId))
    .limit(1);

  const t = rows[0];
  // Same externally-observable behavior as the old RLS-filtered maybeSingle(): out of scope
  // looks identical to not found.
  if (!t || !(await hasUnitScope(actor, t.unitId))) return null;

  const recordedByUsers = users;
  const authorUsers = users;

  const [eventRows, annotationRows, alertRows] = await Promise.all([
    db
      .select({
        id: taskStatusEvents.id,
        status: taskStatusEvents.status,
        comment: taskStatusEvents.comment,
        photoUrl: taskStatusEvents.photoUrl,
        createdAt: taskStatusEvents.createdAt,
        recordedByName: recordedByUsers.fullName,
        recordedByRole: recordedByUsers.role,
      })
      .from(taskStatusEvents)
      .innerJoin(recordedByUsers, eq(recordedByUsers.id, taskStatusEvents.recordedBy))
      .where(eq(taskStatusEvents.taskId, taskId))
      .orderBy(desc(taskStatusEvents.createdAt)),
    db
      .select({
        id: eventAnnotations.id,
        eventId: eventAnnotations.eventId,
        body: eventAnnotations.body,
        createdAt: eventAnnotations.createdAt,
        authorName: authorUsers.fullName,
      })
      .from(eventAnnotations)
      .innerJoin(authorUsers, eq(authorUsers.id, eventAnnotations.authorId))
      .innerJoin(taskStatusEvents, eq(taskStatusEvents.id, eventAnnotations.eventId))
      .where(eq(taskStatusEvents.taskId, taskId)),
    db
      .select({ id: alerts.id, type: alerts.type, triggeredAt: alerts.triggeredAt, resolvedAt: alerts.resolvedAt })
      .from(alerts)
      .where(eq(alerts.taskId, taskId))
      .orderBy(desc(alerts.triggeredAt)),
  ]);

  const annotationsByEvent = new Map<string, typeof annotationRows>();
  for (const a of annotationRows) {
    const list = annotationsByEvent.get(a.eventId) ?? [];
    list.push(a);
    annotationsByEvent.set(a.eventId, list);
  }

  return {
    id: t.id,
    description: t.description,
    pictureUrl: t.pictureUrl,
    markerX: t.markerX,
    markerY: t.markerY,
    isCritical: t.isCritical,
    noOfPoints: t.noOfPoints,
    lubricationPoints: t.lubricationPoints,
    frequencyLabel: t.frequencyLabel,
    lubricantName: t.lubricantName,
    sectionCode: t.sectionCode,
    unitCode: t.unitCode,
    unitName: t.unitName,
    archivedAt: t.archivedAt ? t.archivedAt.toISOString() : null,
    events: eventRows.map((e) => ({
      id: e.id,
      status: e.status,
      comment: e.comment,
      photoUrl: e.photoUrl,
      createdAt: e.createdAt.toISOString(),
      recordedByName: e.recordedByName,
      recordedByRole: e.recordedByRole,
      annotations: (annotationsByEvent.get(e.id) ?? []).map((a) => ({
        id: a.id,
        body: a.body,
        createdAt: a.createdAt.toISOString(),
        authorName: a.authorName,
      })),
    })),
    alerts: alertRows.map((a) => ({
      id: a.id,
      type: a.type,
      triggeredAt: a.triggeredAt.toISOString(),
      resolvedAt: a.resolvedAt ? a.resolvedAt.toISOString() : null,
    })),
  };
}