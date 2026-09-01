import { notFound } from "next/navigation";
import { isPreviewRole, canManageMachines } from "../../mock-data";

export default async function PreviewReportsPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isPreviewRole(role)) notFound();

  if (!canManageMachines(role)) {
    return (
      <div className="glass-panel p-6 text-sm text-white/60">
        This role doesn&apos;t have access to Reports in the real app.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Reports</h1>
      <div className="glass-panel flex flex-col gap-4 p-6">
        <p className="text-sm text-white/60">
          Exports every check-off record this role has visibility over, as CSV or PDF.
        </p>
        <div className="flex gap-3">
          <button className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80">
            Download CSV (Excel)
          </button>
          <button className="rounded-lg bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-brand-teal)] px-4 py-2 text-sm font-semibold text-navy-950">
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}