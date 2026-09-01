import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { Siren } from "lucide-react";
import { getCurrentProfile, canManageMachines } from "@/lib/auth/current-profile";
import { scopedUnitIds } from "@/lib/auth/authorize";
import { db } from "@/lib/db/client";
import { lubricants, sections, tasks, units } from "@/lib/db/schema";
import { createUnit, archiveUnit, createSection, archiveSection, archiveTask, createLubricant } from "@/app/actions/machines";
import { AddTaskForm } from "@/components/add-task-form";
import { CloneUnitForm } from "@/components/clone-unit-form";

export default async function MachinesPage() {
  const profile = await getCurrentProfile();
  if (!profile || !canManageMachines(profile.role)) {
    redirect("/dashboard/tasks");
  }

  const canAddUnit = profile.role === "super_admin" || profile.role === "production_engineer";
  const canArchive = profile.role === "super_admin";

  const scope = await scopedUnitIds(profile);
  const canQueryUnits = scope === "all" || scope.length > 0;

  const [unitRows, allLubricants] = await Promise.all([
    canQueryUnits
      ? db
          .select({ id: units.id, code: units.code, name: units.name, archivedAt: units.archivedAt })
          .from(units)
          .where(scope === "all" ? undefined : inArray(units.id, scope))
          .orderBy(units.code)
      : Promise.resolve([]),
    db.select({ id: lubricants.id, name: lubricants.name }).from(lubricants).orderBy(lubricants.name),
  ]);

  const visibleUnits = unitRows;
  const unitIds = visibleUnits.map((u) => u.id);

  const sectionRows =
    unitIds.length > 0
      ? await db
          .select({ id: sections.id, unitId: sections.unitId, code: sections.code, name: sections.name, archivedAt: sections.archivedAt })
          .from(sections)
          .where(inArray(sections.unitId, unitIds))
          .orderBy(sections.code)
      : [];
  const sectionIds = sectionRows.map((s) => s.id);

  const taskRows =
    sectionIds.length > 0
      ? await db
          .select({
            id: tasks.id,
            sectionId: tasks.sectionId,
            description: tasks.description,
            frequencyLabel: tasks.frequencyLabel,
            noOfPoints: tasks.noOfPoints,
            lubricationPoints: tasks.lubricationPoints,
            archivedAt: tasks.archivedAt,
            isCritical: tasks.isCritical,
            lubricantName: lubricants.name,
          })
          .from(tasks)
          .leftJoin(lubricants, eq(lubricants.id, tasks.lubricantId))
          .where(inArray(tasks.sectionId, sectionIds))
      : [];

  const tasksBySection = new Map<string, typeof taskRows>();
  for (const t of taskRows) {
    const list = tasksBySection.get(t.sectionId) ?? [];
    list.push(t);
    tasksBySection.set(t.sectionId, list);
  }

  const sectionsByUnit = new Map<string, typeof sectionRows>();
  for (const s of sectionRows) {
    const list = sectionsByUnit.get(s.unitId) ?? [];
    list.push(s);
    sectionsByUnit.set(s.unitId, list);
  }

  const unitTree = visibleUnits.map((u) => ({
    ...u,
    sections: (sectionsByUnit.get(u.id) ?? []).map((s) => ({ ...s, tasks: tasksBySection.get(s.id) ?? [] })),
  }));

  const activeUnits = unitTree.filter((u) => !u.archivedAt).map((u) => ({ id: u.id, code: u.code, name: u.name }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Machines</h1>
      </div>

      {canAddUnit ? (
        <>
          <form action={createUnit} className="glass-panel flex flex-wrap items-end gap-3 p-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/60">New unit code</label>
              <input name="code" placeholder="e.g. EF" required className="glass-input px-3 py-1.5 text-sm text-white" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/60">Unit name</label>
              <input name="name" placeholder="e.g. E Flute" required className="glass-input px-3 py-1.5 text-sm text-white" />
            </div>
            <button className="rounded-lg bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-brand-teal)] px-4 py-1.5 text-sm font-semibold text-navy-950">
              Add Unit
            </button>
          </form>

          <CloneUnitForm units={activeUnits} />
        </>
      ) : null}

      <form action={createLubricant} className="glass-panel flex flex-wrap items-end gap-3 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/60">New lubricant type</label>
          <input name="name" placeholder="e.g. (Gadus) S2 V 220" required className="glass-input px-3 py-1.5 text-sm text-white" />
        </div>
        <button className="rounded-lg border border-white/15 px-4 py-1.5 text-sm text-white/80 hover:bg-white/8">
          Add Lubricant
        </button>
      </form>

      {unitTree.map((unit) => (
        <div key={unit.id} className="glass-panel flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              {unit.name} ({unit.code}) {unit.archivedAt ? <span className="status-pill status-pill--neutral ml-2">Archived</span> : null}
            </h2>
            {canArchive && !unit.archivedAt ? (
              <form action={archiveUnit}>
                <input type="hidden" name="id" value={unit.id} />
                <button className="rounded-lg border border-[var(--color-status-overdue)]/40 px-3 py-1 text-xs text-[var(--color-status-overdue)] hover:bg-[var(--color-status-overdue)]/10">
                  Archive Unit
                </button>
              </form>
            ) : null}
          </div>

          {unit.sections.map((section) => (
            <div key={section.id} className="glass-input flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">
                  {section.code} {section.name ? `— ${section.name}` : ""}
                  {section.archivedAt ? <span className="status-pill status-pill--neutral ml-2">Archived</span> : null}
                </h3>
                {canArchive && !section.archivedAt ? (
                  <form action={archiveSection}>
                    <input type="hidden" name="id" value={section.id} />
                    <button className="text-xs text-[var(--color-status-overdue)] hover:underline">Archive</button>
                  </form>
                ) : null}
              </div>

              <ul className="flex flex-col gap-1">
                {section.tasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between text-xs text-white/70">
                    <span className="flex items-center gap-1.5">
                      {task.isCritical ? (
                        <Siren size={13} className="shrink-0 text-[var(--color-status-critical)]" />
                      ) : null}
                      {task.description} · {task.frequencyLabel} · {task.lubricantName ?? "no lubricant set"}
                      {task.archivedAt ? " · archived" : ""}
                    </span>
                    {canArchive && !task.archivedAt ? (
                      <form action={archiveTask}>
                        <input type="hidden" name="id" value={task.id} />
                        <button className="text-[var(--color-status-overdue)] hover:underline">Archive</button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>

              <AddTaskForm sectionId={section.id} lubricants={allLubricants} />
            </div>
          ))}

          <form action={createSection} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="unitId" value={unit.id} />
            <input name="code" placeholder="Section code e.g. RS-1" required className="glass-input px-2.5 py-1.5 text-xs text-white" />
            <input name="name" placeholder="Section name (optional)" className="glass-input px-2.5 py-1.5 text-xs text-white" />
            <button className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/8">
              Add Section
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}
