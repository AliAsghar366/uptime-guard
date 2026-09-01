import { getAnalytics } from "@/lib/data/analytics";
import { AnalyticsCharts } from "@/components/analytics-charts";

export default async function AnalyticsPage() {
  const data = await getAnalytics();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Analytics</h1>
      <p className="-mt-4 text-xs text-white/40">
        Scoped to the units your account has access to.
      </p>
      <AnalyticsCharts data={data} />
    </div>
  );
}