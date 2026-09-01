import { redirect } from "next/navigation";
import { isNull } from "drizzle-orm";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { db } from "@/lib/db/client";
import { alertSettings } from "@/lib/db/schema";
import { updateGlobalAlertSettings } from "@/app/actions/settings";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    redirect("/dashboard/tasks");
  }

  const rows = await db
    .select({ leadTimeDays: alertSettings.leadTimeDays, escalationDays: alertSettings.escalationDays })
    .from(alertSettings)
    .where(isNull(alertSettings.taskId))
    .limit(1);
  const settings = rows[0];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Alert Settings</h1>
      <form action={updateGlobalAlertSettings} className="glass-panel flex flex-col gap-4 p-6 max-w-md">
        <p className="text-xs text-white/50">
          Plant-wide defaults. Applies to every task unless a specific task has its own override.
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/60">Due-soon lead time (days before due date)</label>
          <input
            name="leadTimeDays"
            type="number"
            min={1}
            defaultValue={settings?.leadTimeDays ?? 2}
            className="glass-input px-3 py-1.5 text-sm text-white"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/60">Escalate to critical after (days overdue)</label>
          <input
            name="escalationDays"
            type="number"
            min={1}
            defaultValue={settings?.escalationDays ?? 2}
            className="glass-input px-3 py-1.5 text-sm text-white"
          />
        </div>
        <button className="w-fit rounded-lg bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-brand-teal)] px-4 py-1.5 text-sm font-semibold text-navy-950">
          Save
        </button>
      </form>
    </div>
  );
}