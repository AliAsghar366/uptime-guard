import { notFound } from "next/navigation";
import { CheckCircle2, AlertTriangle, ImageOff } from "lucide-react";
import { isPreviewRole, mockTasks, scopedUnits } from "../../mock-data";
import { badgeLabel, badgeClass } from "@/lib/status";

export default async function PreviewTasksPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isPreviewRole(role)) notFound();

  const allowedUnits = new Set(scopedUnits(role));
  const tasks = mockTasks.filter((t) => allowedUnits.has(t.unitCode));

  const grouped = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (!grouped.has(t.unitCode)) grouped.set(t.unitCode, []);
    grouped.get(t.unitCode)!.push(t);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Lubrication Tasks</h1>
      <p className="-mt-4 text-xs text-white/40">
        No task here has a reference photo yet in this fake dataset — the grey box is the
        real app&apos;s actual empty-photo state, not a broken image.
      </p>

      {[...grouped.entries()].map(([unitCode, unitTasks]) => (
        <section key={unitCode} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">
            {unitTasks[0].unitName} ({unitCode})
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {unitTasks.map((task) => (
              <div key={task.id} className="glass-panel flex flex-col gap-3 p-4">
                <div className="flex gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/25">
                    <ImageOff size={18} strokeWidth={1.5} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm font-medium leading-snug text-white">{task.sectionCode}</span>
                    <p className="text-xs leading-snug text-white/70">{task.description}</p>
                  </div>
                  <span className={`status-pill ${badgeClass(task.badge)} h-fit shrink-0`}>
                    {badgeLabel(task.badge)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-white/55">
                  <span>Points: {task.noOfPoints}</span>
                  <span>Lube points: {task.lubricationPoints}</span>
                  <span>Frequency: {task.frequencyLabel}</span>
                  <span>Lubricant: {task.lubricantName}</span>
                  <span>Last done: {task.lastDone}</span>
                  <span>Next due: {task.nextDue}</span>
                </div>
                <div className="flex gap-2">
                  <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-status-working)]/40 bg-[var(--color-status-working)]/10 px-3 py-2 text-sm font-semibold text-[var(--color-status-working)]">
                    <CheckCircle2 size={16} /> Mark OK
                  </button>
                  <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-status-not-working)]/40 bg-[var(--color-status-not-working)]/10 px-3 py-2 text-sm font-semibold text-[var(--color-status-not-working)]">
                    <AlertTriangle size={16} /> Not Working
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}