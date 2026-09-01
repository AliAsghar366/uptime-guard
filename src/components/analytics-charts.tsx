"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import type { AnalyticsData } from "@/lib/data/analytics";

const COLORS = {
  onTrack: "#2dd4bf",
  dueSoon: "#fbbf24",
  overdue: "#f87171",
  critical: "#ef4444",
  notWorking: "#ef4444",
};

const tooltipStyle = {
  background: "rgba(11,30,51,0.9)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 8,
  color: "white",
  fontSize: 12,
};

export function AnalyticsCharts({ data }: { data: AnalyticsData }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Total Points" value={data.totalTasks} />
        <StatTile label="Working" value={data.workingCount} accent="working" />
        <StatTile label="Not Working" value={data.notWorkingCount} accent="critical" />
        <StatTile
          label="Compliance"
          value={
            data.totalTasks === 0 ? "—" : `${Math.round((data.workingCount / data.totalTasks) * 100)}%`
          }
        />
      </div>

      <div className="glass-panel p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">Status by Unit</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.byUnit}>
            <XAxis dataKey="unitCode" stroke="rgba(255,255,255,0.5)" fontSize={12} />
            <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12, color: "white" }} />
            <Bar dataKey="onTrack" stackId="a" name="On track" fill={COLORS.onTrack} />
            <Bar dataKey="dueSoon" stackId="a" name="Due soon" fill={COLORS.dueSoon} />
            <Bar dataKey="overdue" stackId="a" name="Overdue" fill={COLORS.overdue} />
            <Bar dataKey="critical" stackId="a" name="Critical" fill={COLORS.critical} />
            <Bar dataKey="notWorking" stackId="a" name="Not working" fill={COLORS.notWorking} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-panel p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">Check-off Activity (last 30 days)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data.activityByDay}>
            <XAxis dataKey="day" stroke="rgba(255,255,255,0.5)" fontSize={11} />
            <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="checks" stroke="#3b9ef5" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "working" | "critical";
}) {
  const color =
    accent === "working"
      ? "text-[var(--color-status-working)]"
      : accent === "critical"
      ? "text-[var(--color-status-critical)]"
      : "text-white";
  return (
    <div className="glass-panel p-4">
      <div className="text-xs text-white/50">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}