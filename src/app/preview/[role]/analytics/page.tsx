import { notFound } from "next/navigation";
import { isPreviewRole, mockAnalyticsFor } from "../../mock-data";
import { AnalyticsCharts } from "@/components/analytics-charts";

export default async function PreviewAnalyticsPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isPreviewRole(role)) notFound();

  const data = mockAnalyticsFor(role);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Analytics</h1>
      <p className="-mt-4 text-xs text-white/40">
        Scoped to the units this role has access to (fake data).
      </p>
      <AnalyticsCharts data={data} />
    </div>
  );
}