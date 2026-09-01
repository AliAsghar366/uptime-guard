"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { eventAnnotations } from "@/lib/db/schema";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { assertCanAnnotate, AuthorizationError } from "@/lib/auth/authorize";
import { recordStatusEvent } from "@/lib/services/status-events";
import { logActivity } from "@/lib/services/activity-log";
import { isAcceptableImage, saveUploadedPhoto } from "@/lib/storage/supabase";

export type ActionState = { error: string | null; success?: boolean };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordTaskStatus(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentProfile();
  if (!actor) {
    return { error: "You must be signed in." };
  }

  const taskId = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "");
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 1000);
  const photo = formData.get("photo") as File | null;

  if (!UUID_PATTERN.test(taskId) || (status !== "working" && status !== "not_working")) {
    return { error: "Invalid submission." };
  }

  let photoUrl: string | null = null;

  if (photo && photo.size > 0) {
    if (!photo.type.startsWith("image/")) {
      return { error: "Only image files can be attached." };
    }
    if (!isAcceptableImage(photo)) {
      return { error: "Photo is too large (max 8MB)." };
    }
    photoUrl = await saveUploadedPhoto("task-photos", taskId, photo);
  }

  try {
    await recordStatusEvent(actor, { taskId, status, comment: comment || null, photoUrl });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return { error: `Could not save this update. ${err.message}` };
    }
    return { error: "Could not save this update. You may not have access to this task." };
  }

  revalidatePath("/dashboard/tasks");
  revalidatePath(`/dashboard/machines/${taskId}`);
  revalidatePath("/dashboard/alerts");

  return { error: null, success: true };
}

export async function addEventAnnotation(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentProfile();
  if (!actor) {
    return { error: "You must be signed in." };
  }

  const eventId = String(formData.get("eventId") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 1000);

  if (!UUID_PATTERN.test(eventId) || !body) {
    return { error: "Comment cannot be empty." };
  }

  try {
    assertCanAnnotate(actor);
  } catch {
    return { error: "Could not add comment. Only Admin tier and above can comment." };
  }

  const id = crypto.randomUUID();
  await db.insert(eventAnnotations).values({ id, eventId, authorId: actor.id, body });
  await logActivity(db, actor, "insert", "event_annotations", id, null, { eventId, body });

  revalidatePath("/dashboard", "layout");
  return { error: null, success: true };
}