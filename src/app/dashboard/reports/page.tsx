export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Reports</h1>
      <div className="glass-panel flex flex-col gap-4 p-6">
        <p className="text-sm text-white/60">
          Exports every check-off record you have visibility over (up to the most recent 2,000
          entries), including date, unit, section, task, status, who recorded it, and any comment.
        </p>
        <div className="flex gap-3">
          <a
            href="/api/reports/export?format=csv"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/8"
          >
            Download CSV (Excel)
          </a>
          <a
            href="/api/reports/export?format=pdf"
            className="rounded-lg bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-brand-teal)] px-4 py-2 text-sm font-semibold text-navy-950"
          >
            Download PDF
          </a>
        </div>
      </div>
    </div>
  );
}