"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alertSettings, lubricants, sections, tasks, units } from "@/lib/db/schema";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import {
  assertCanArchiveUnit,
  assertCanCreateUnit,
  assertCanManageLubricants,
  assertCanManageUnitScopedRecord,
  AuthorizationError,
} from "@/lib/auth/authorize";
import { logActivity } from "@/lib/services/activity-log";
import { isAcceptableImage, saveUploadedPhoto } from "@/lib/storage/local";

const FREQUENCY_DAYS: Record<string, number> = {
  Weekly: 7,
  "2 Weeks": 14,
  Monthly: 30,
};

const CRITICAL_LUBRICANT_PATTERN = /gleitmo/i;

export async function createUnit(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor) return;
  try {
    assertCanCreateUnit(actor);
  } catch {
    return;
  }

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!code || !name) return;

  const id = crypto.randomUUID();
  await db.insert(units).values({ id, code, name });
  await logActivity(db, actor, "insert", "units", id, null, { code, name });
  revalidatePath("/dashboard/machines");
}

export type CloneUnitState = { error: string | null; success?: boolean };

export async function cloneUnit(_prevState: CloneUnitState, formData: FormData): Promise<CloneUnitState> {
  const actor = await getCurrentProfile();
  if (!actor) return { error: "You must be signed in." };

  try {
    assertCanCreateUnit(actor);
  } catch (err) {
    return { error: err instanceof AuthorizationError ? err.message : "Not authorized." };
  }

  const sourceUnitId = String(formData.get("sourceUnitId") ?? "");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();

  if (!sourceUnitId || !code || !name) {
    return { error: "Pick a source unit and give the new one a code and name." };
  }

  const sourceSections = await db
    .select({ id: sections.id, code: sections.code, name: sections.name })
    .from(sections)
    .where(and(eq(sections.unitId, sourceUnitId), isNull(sections.archivedAt)));

  const newUnitId = crypto.randomUUID();
  try {
    await db.insert(units).values({ id: newUnitId, code, name });
  } catch {
    return { error: "Could not create the new unit — code may already be in use." };
  }
  await logActivity(db, actor, "insert", "units", newUnitId, null, { code, name });

  for (const section of sourceSections) {
    const newSectionId = crypto.randomUUID();
    try {
      await db.insert(sections).values({ id: newSectionId, unitId: newUnitId, code: section.code, name: section.name });
    } catch {
      continue;
    }
    await logActivity(db, actor, "insert", "sections", newSectionId, null, {
      unitId: newUnitId,
      code: section.code,
      name: section.name,
    });

    const sectionTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.sectionId, section.id), isNull(tasks.archivedAt)));

    // Reference photos are intentionally NOT cloned -- a cloned machine is a physically
    // different piece of equipment, and the photo shows a specific real bearing/shaft.
    if (sectionTasks.length > 0) {
      const newTasks = sectionTasks.map((t) => ({
        id: crypto.randomUUID(),
        sectionId: newSectionId,
        description: t.description,
        noOfPoints: t.noOfPoints,
        lubricationPoints: t.lubricationPoints,
        frequencyLabel: t.frequencyLabel,
        frequencyDays: t.frequencyDays,
        lubricantId: t.lubricantId,
        isCritical: t.isCritical,
      }));
      await db.insert(tasks).values(newTasks);
      for (const t of newTasks) {
        await logActivity(db, actor, "insert", "tasks", t.id, null, { sectionId: newSectionId, description: t.description });
      }
    }
  }

  revalidatePath("/dashboard/machines");
  return { error: null, success: true };
}

export async function archiveUnit(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor) return;
  try {
    assertCanArchiveUnit(actor);
  } catch {
    return;
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const archivedAt = new Date();
  await db.update(units).set({ archivedAt }).where(eq(units.id, id));
  await logActivity(db, actor, "update", "units", id, null, { archivedAt });
  revalidatePath("/dashboard/machines");
}

export async function createSection(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor) return;

  const unitId = String(formData.get("unitId") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!unitId || !code) return;

  try {
    await assertCanManageUnitScopedRecord(actor, unitId);
  } catch {
    return;
  }

  const id = crypto.randomUUID();
  await db.insert(sections).values({ id, unitId, code, name: name || null });
  await logActivity(db, actor, "insert", "sections", id, null, { unitId, code, name: name || null });
  revalidatePath("/dashboard/machines");
}

export async function archiveSection(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const rows = await db.select({ unitId: sections.unitId }).from(sections).where(eq(sections.id, id)).limit(1);
  const section = rows[0];
  if (!section) return;

  try {
    await assertCanManageUnitScopedRecord(actor, section.unitId);
  } catch {
    return;
  }

  const archivedAt = new Date();
  await db.update(sections).set({ archivedAt }).where(eq(sections.id, id));
  await logActivity(db, actor, "update", "sections", id, null, { archivedAt });
  revalidatePath("/dashboard/machines");
}

export type TaskFormState = {
  error: string | null;
  warning: string | null;
  warningType?: "duplicate" | "frequency" | null;
  success?: boolean;
};

export async function createTask(_prevState: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const actor = await getCurrentProfile();
  if (!actor) return { error: "You must be signed in.", warning: null };

  const sectionId = String(formData.get("sectionId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const noOfPoints = Number(formData.get("noOfPoints") ?? 1);
  const lubricationPoints = Number(formData.get("lubricationPoints") ?? 1);
  const frequencyLabel = String(formData.get("frequencyLabel") ?? "Weekly");
  const lubricantId = String(formData.get("lubricantId") ?? "") || null;
  const forceCritical = formData.get("isCritical") === "true";
  const picture = formData.get("picture") as File | null;
  const markerX = formData.get("markerX") ? Number(formData.get("markerX")) : null;
  const markerY = formData.get("markerY") ? Number(formData.get("markerY")) : null;
  const confirmDuplicate = formData.get("confirmDuplicate") === "true";
  const confirmFrequency = formData.get("confirmFrequency") === "true";

  if (!sectionId || !description) {
    return { error: "Section and description are required.", warning: null, warningType: null };
  }

  const sectionRows = await db.select({ unitId: sections.unitId }).from(sections).where(eq(sections.id, sectionId)).limit(1);
  const section = sectionRows[0];
  if (!section) return { error: "Section not found.", warning: null };

  try {
    await assertCanManageUnitScopedRecord(actor, section.unitId);
  } catch (err) {
    return { error: err instanceof AuthorizationError ? err.message : "Not authorized.", warning: null };
  }

  const existingTasks = await db
    .select({ description: tasks.description, frequencyLabel: tasks.frequencyLabel })
    .from(tasks)
    .where(and(eq(tasks.sectionId, sectionId), isNull(tasks.archivedAt)));

  // 1. Duplicate-description check -- spotted this exact pattern in the source PDFs
  // (the same task description appearing twice in a section with different point counts).
  if (!confirmDuplicate) {
    const duplicate = existingTasks.find((t) => t.description.trim().toLowerCase() === description.toLowerCase());
    if (duplicate) {
      return {
        error: null,
        warning: `A task with this exact description already exists in this section ("${duplicate.description}"). Submit again to confirm this is intentional (e.g. two separate physical points).`,
        warningType: "duplicate",
      };
    }
  }

  // 2. Frequency-anomaly check -- the source PDFs had two "Monthly" tasks sitting inside an
  // otherwise all-"2 Weeks" section, which may have been a typo nobody caught.
  if (!confirmFrequency && existingTasks.length > 0) {
    const counts = new Map<string, number>();
    for (const t of existingTasks) counts.set(t.frequencyLabel, (counts.get(t.frequencyLabel) ?? 0) + 1);
    const [majorityLabel, majorityCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (majorityLabel !== frequencyLabel && majorityCount === existingTasks.length) {
      return {
        error: null,
        warning: `Every other task in this section is set to "${majorityLabel}", but this one is "${frequencyLabel}". Submit again to confirm this is intentional.`,
        warningType: "frequency",
      };
    }
  }

  let isCritical = forceCritical;
  if (!isCritical && lubricantId) {
    const lubricantRows = await db.select({ name: lubricants.name }).from(lubricants).where(eq(lubricants.id, lubricantId)).limit(1);
    if (lubricantRows[0] && CRITICAL_LUBRICANT_PATTERN.test(lubricantRows[0].name)) isCritical = true;
  }

  const taskId = crypto.randomUUID();
  try {
    await db.insert(tasks).values({
      id: taskId,
      sectionId,
      description,
      noOfPoints,
      lubricationPoints,
      frequencyLabel,
      frequencyDays: FREQUENCY_DAYS[frequencyLabel] ?? 7,
      lubricantId,
      isCritical,
    });
  } catch {
    return { error: "Could not create the task.", warning: null };
  }
  await logActivity(db, actor, "insert", "tasks", taskId, null, { sectionId, description, isCritical });

  // Critical points (high-load bearings running Gleitmo 591 in the source data) get a
  // tighter alert window than the plant-wide default, automatically.
  if (isCritical) {
    const globalRows = await db
      .select({ leadTimeDays: alertSettings.leadTimeDays, escalationDays: alertSettings.escalationDays })
      .from(alertSettings)
      .where(isNull(alertSettings.taskId))
      .limit(1);
    const g = globalRows[0] ?? { leadTimeDays: 2, escalationDays: 2 };
    const lead = Math.max(1, Math.floor(g.leadTimeDays / 2));
    const escalation = Math.max(1, Math.floor(g.escalationDays / 2));
    await db.insert(alertSettings).values({ id: crypto.randomUUID(), taskId, leadTimeDays: lead, escalationDays: escalation });
  }

  if (picture && isAcceptableImage(picture)) {
    const relPath = await saveUploadedPhoto("reference-photos", taskId, picture);
    await db
      .update(tasks)
      .set({
        pictureUrl: relPath,
        pictureMarkerX: markerX !== null && markerX >= 0 && markerX <= 1 ? markerX : null,
        pictureMarkerY: markerY !== null && markerY >= 0 && markerY <= 1 ? markerY : null,
      })
      .where(eq(tasks.id, taskId));
  }

  revalidatePath("/dashboard/machines");
  revalidatePath("/dashboard/tasks");
  return { error: null, warning: null, success: true };
}

export async function archiveTask(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const rows = await db
    .select({ unitId: sections.unitId })
    .from(tasks)
    .innerJoin(sections, eq(sections.id, tasks.sectionId))
    .where(eq(tasks.id, id))
    .limit(1);
  const task = rows[0];
  if (!task) return;

  try {
    await assertCanManageUnitScopedRecord(actor, task.unitId);
  } catch {
    return;
  }

  const archivedAt = new Date();
  await db.update(tasks).set({ archivedAt }).where(eq(tasks.id, id));
  await logActivity(db, actor, "update", "tasks", id, null, { archivedAt });
  revalidatePath("/dashboard/machines");
  revalidatePath("/dashboard/tasks");
}

export async function createLubricant(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor) return;
  try {
    assertCanManageLubricants(actor);
  } catch {
    return;
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const id = crypto.randomUUID();
  await db.insert(lubricants).values({ id, name });
  await logActivity(db, actor, "insert", "lubricants", id, null, { name });
  revalidatePath("/dashboard/machines");
}