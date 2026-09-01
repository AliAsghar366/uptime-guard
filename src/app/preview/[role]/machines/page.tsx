import { notFound } from "next/navigation";
import { isPreviewRole, canManageMachines, canArchive, scopedUnits } from "../../mock-data";

const UNIT_DATA: Record<string, { name: string; sections: { code: string; tasks: string[] }[] }> = {
  BF: {
    name: "B Flute",
    sections: [
      { code: "RS-1", tasks: ["Chuck shafts", "Hydraulic cylinder rod eyes", "Pivot shafts"] },
      { code: "QF-P (CF)", tasks: ["Corrugating roll bearings", "Pressure roll bearing"] },
    ],
  },
  CF: {
    name: "C Flute",
    sections: [{ code: "RS-2", tasks: ["Chuck shafts", "Pivot shafts"] }],
  },
  DF: {
    name: "Double Facer",
    sections: [
      { code: "GU", tasks: ["Doctor roll bearing", "Lever joints"] },
      { code: "HPH-A II", tasks: ["Pre heater bearing", "Guide rolls"] },
    ],
  },
};

export default async function PreviewMachinesPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isPreviewRole(role)) notFound();

  if (!canManageMachines(role)) {
    return (
      <div className="glass-panel p-6 text-sm text-white/60">
        This role doesn&apos;t have access to Machine management — in the real app it would
        redirect straight back to Tasks. That&apos;s the permission boundary working as intended.
      </div>
    );
  }

  const units = scopedUnits(role);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Machines</h1>

      {units.map((unitCode) => {
        const unit = UNIT_DATA[unitCode];
        return (
          <div key={unitCode} className="glass-panel flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                {unit.name} ({unitCode})
              </h2>
              {canArchive(role) ? (
                <button className="rounded-lg border border-[var(--color-status-overdue)]/40 px-3 py-1 text-xs text-[var(--color-status-overdue)]">
                  Archive Unit
                </button>
              ) : null}
            </div>
            {unit.sections.map((section) => (
              <div key={section.code} className="glass-input flex flex-col gap-2 p-4">
                <h3 className="text-sm font-medium text-white">{section.code}</h3>
                <ul className="flex flex-col gap-1 text-xs text-white/70">
                  {section.tasks.map((t) => (
                    <li key={t} className="flex items-center justify-between">
                      <span>{t}</span>
                      {canArchive(role) ? (
                        <button className="text-[var(--color-status-overdue)] hover:underline">Archive</button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}