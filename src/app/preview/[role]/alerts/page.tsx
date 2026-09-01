import { notFound } from "next/navigation";
import { Clock, AlertOctagon, Siren, PowerOff, type LucideIcon } from "lucide-react";
import { isPreviewRole, mockAlerts, scopedUnits } from "../../mock-data";

const TYPE_PILL: Record<string, string> = {
  due_soon: "status-pill--due-soon",
  overdue: "status-pill--overdue",
  critical: "status-pill--critical",
  not_working: "status-pill--critical",
};

const TYPE_ICON: Record<string, LucideIcon> = {
  due_soon: Clock,
  overdue: AlertOctagon,
  critical: Siren,
  not_working: PowerOff,
};

export default async function PreviewAlertsPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isPreviewRole(role)) notFound();

  const allowedUnits = new Set(scopedUnits(role));
  const alerts = mockAlerts.filter((a) => allowedUnits.has(a.unit));
  const active = alerts.filter((a) => !a.resolved);
  const resolved = alerts.filter((a) => a.resolved);

  function Row({ alert }: { alert: (typeof alerts)[number] }) {
    const Icon = TYPE_ICON[alert.type] ?? Clock;
    return (
      <div className="glass-input flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2">
          <span className={`status-pill ${TYPE_PILL[alert.type] ?? "status-pill--neutral"}`}>
            <Icon size={12} />
            {alert.type.replace("_", " ")}
          </span>
          <span className="text-sm text-white/80">
            {alert.unit} / {alert.section} — {alert.description}
          </span>
        </div>
        <span className="text-xs text-white/55">{alert.when}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Alerts</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">Active ({active.length})</h2>
        <div className="flex flex-col gap-2">
          {active.map((a) => (
            <Row key={a.id} alert={a} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">History ({resolved.length})</h2>
        <div className="flex flex-col gap-2">
          {resolved.map((a) => (
            <Row key={a.id} alert={a} />
          ))}
        </div>
      </section>
    </div>
  );
}