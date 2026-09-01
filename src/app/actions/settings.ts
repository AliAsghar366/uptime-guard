"use server";

import { revalidatePath } from "next/cache";
import { isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alertSettings } from "@/lib/db/schema";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { logActivity } from "@/lib/services/activity-log";

export async function updateGlobalAlertSettings(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || actor.role !== "super_admin") return;

  const leadTimeDays = Number(formData.get("leadTimeDays") ?? 2);
  const escalationDays = Number(formData.get("escalationDays") ?? 2);

  const rows = await db.select({ id: alertSettings.id }).from(alertSettings).where(isNull(alertSettings.taskId)).limit(1);
  const globalRow = rows[0];
  if (!globalRow) return;

  await db
    .update(alertSettings)
    .set({ leadTimeDays, escalationDays, updatedBy: actor.id, updatedAt: new Date() })
    .where(isNull(alertSettings.taskId));

  await logActivity(db, actor, "update", "alert_settings", globalRow.id, null, { leadTimeDays, escalationDays });
  revalidatePath("/dashboard/settings");
}