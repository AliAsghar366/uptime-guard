import { notFound } from "next/navigation";
import { isPreviewRole, hasFullVisibility, mockActivity } from "../../mock-data";

export default async function PreviewActivityPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isPreviewRole(role)) notFound();

  if (!hasFullVisibility(role)) {
    return (
      <div className="glass-panel p-6 text-sm text-white/60">
        Only Super Admin and Production Engineer see the full Activity Log — everyone else&apos;s
        history is scoped through Tasks/Alerts/Machines instead.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Activity Log</h1>
      <div className="glass-panel flex flex-col divide-y divide-white/8">
        {mockActivity.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
            <span className="text-white/80">
              <span className="font-medium">{entry.who}</span>{" "}
              <span className="text-white/40">({entry.role})</span> {entry.action}
            </span>
            <span className="shrink-0 text-white/40">{entry.when}</span>
          </div>
        ))}
      </div>
    </div>
  );
}