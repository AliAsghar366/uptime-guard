import Link from "next/link";
import { Siren } from "lucide-react";
import { getTasksWithStatus } from "@/lib/data/tasks";
import { computeBadge, badgeLabel, badgeClass } from "@/lib/status";
import { TaskCheckoffForm } from "@/components/task-checkoff-form";
import { ReferencePhotoThumb } from "@/components/reference-photo-thumb";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function TasksPage() {
  const tasks = await getTasksWithStatus();

  const groupedByUnit = new Map<string, { unitName: string; unitCode: string; tasks: typeof tasks }>();
  for (const task of tasks) {
    if (!groupedByUnit.has(task.unitId)) {
      groupedByUnit.set(task.unitId, { unitName: task.unitName, unitCode: task.unitCode, tasks: [] });
    }
    groupedByUnit.get(task.unitId)!.tasks.push(task);
  }

  if (tasks.length === 0) {
    return (
      <div className="glass-panel p-6 text-sm text-white/60">
        No lubrication points are assigned to your account yet. Ask a Super Admin or Admin to
        assign you to a unit.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Lubrication Tasks</h1>

      {[...groupedByUnit.values()].map((group) => (
        <section key={group.unitCode} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">
            {group.unitName} ({group.unitCode})
          </h2>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.tasks.map((task) => {
              const badge = computeBadge({
                currentStatus: task.currentStatus,
                nextDueAt: task.nextDueAt,
                leadTimeDays: task.leadTimeDays,
                escalationDays: task.escalationDays,
              });

              return (
                <div key={task.id} className="glass-panel flex flex-col gap-3 p-4">
                  <div className="flex gap-3">
                    <Link href={`/dashboard/machines/${task.id}`} title="Open full history">
                      <ReferencePhotoThumb
                        photoUrl={task.photoDisplayUrl}
                        markerX={task.markerX}
                        markerY={task.markerY}
                        alt={task.description}
                      />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Link
                        href={`/dashboard/machines/${task.id}`}
                        className="flex items-center gap-1.5 text-sm font-medium leading-snug text-white hover:text-[var(--color-brand-blue)]"
                        title={
                          task.sectionName
                            ? `${task.sectionCode} — ${task.sectionName}`
                            : `${task.sectionCode} (no descriptive name set — an Admin can add one under Machines)`
                        }
                      >
                        {task.isCritical ? (
                          <Siren size={13} className="shrink-0 text-[var(--color-status-critical)]" />
                        ) : null}
                        {task.sectionName ? `${task.sectionCode} — ${task.sectionName}` : task.sectionCode}
                      </Link>
                      <p className="text-xs leading-snug text-white/70">{task.description}</p>
                    </div>

                    <span className={`status-pill ${badgeClass(badge)} h-fit shrink-0`}>
                      {badgeLabel(badge)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-white/55">
                    <span>Points: {task.noOfPoints}</span>
                    <span>Lube points: {task.lubricationPoints}</span>
                    <span>Frequency: {task.frequencyLabel}</span>
                    <span>Lubricant: {task.lubricantName ?? "—"}</span>
                    <span>Last done: {formatDate(task.lastChangedAt)}</span>
                    <span>Next due: {formatDate(task.nextDueAt)}</span>
                  </div>

                  <TaskCheckoffForm taskId={task.id} />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}