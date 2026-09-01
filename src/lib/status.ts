import type { TaskStatus } from "@/lib/db/schema";

export type BadgeState = "working" | "due_soon" | "overdue" | "critical" | "not_working" | "never_checked";

const BADGE_LABEL: Record<BadgeState, string> = {
  working: "On track",
  due_soon: "Due soon",
  overdue: "Overdue",
  critical: "Critical",
  not_working: "Not working",
  never_checked: "Never checked",
};

const BADGE_CLASS: Record<BadgeState, string> = {
  working: "status-pill--working",
  due_soon: "status-pill--due-soon",
  overdue: "status-pill--overdue",
  critical: "status-pill--critical",
  not_working: "status-pill--critical",
  never_checked: "status-pill--neutral",
};

export function computeBadge(params: {
  currentStatus: TaskStatus | null;
  nextDueAt: string | null;
  leadTimeDays: number;
  escalationDays: number;
  now?: Date;
}): BadgeState {
  const { currentStatus, nextDueAt, leadTimeDays, escalationDays } = params;
  const now = params.now ?? new Date();

  if (currentStatus === "not_working") return "not_working";
  if (!nextDueAt) return "never_checked";

  const due = new Date(nextDueAt);
  const daysUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysUntilDue < -escalationDays) return "critical";
  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= leadTimeDays) return "due_soon";
  return "working";
}

export function badgeLabel(state: BadgeState) {
  return BADGE_LABEL[state];
}

export function badgeClass(state: BadgeState) {
  return BADGE_CLASS[state];
}