import { notFound } from "next/navigation";
import { isPreviewRole, canConfigureAlerts } from "../../mock-data";

export default async function PreviewSettingsPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isPreviewRole(role)) notFound();

  if (!canConfigureAlerts(role)) {
    return (
      <div className="glass-panel p-6 text-sm text-white/60">
        Only Super Admin can configure alert timing in the real app.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Alert Settings</h1>
      <div className="glass-panel flex max-w-md flex-col gap-4 p-6">
        <p className="text-xs text-white/50">Plant-wide defaults, applied unless a task has its own override.</p>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/60">Due-soon lead time (days before due date)</label>
          <input defaultValue={2} type="number" className="glass-input px-3 py-1.5 text-sm text-white" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-white/60">Escalate to critical after (days overdue)</label>
          <input defaultValue={2} type="number" className="glass-input px-3 py-1.5 text-sm text-white" />
        </div>
        <button className="w-fit rounded-lg bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-brand-teal)] px-4 py-1.5 text-sm font-semibold text-navy-950">
          Save
        </button>
      </div>
    </div>
  );
}