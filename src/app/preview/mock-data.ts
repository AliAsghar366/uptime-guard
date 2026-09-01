// Fake, disconnected data for the /preview/* routes only. Nothing here touches the database.
// Delete the whole src/app/preview directory once the real app is connected and tested.

export type PreviewRole = "super-admin" | "production-engineer" | "admin" | "operator";

export const ROLE_INFO: Record<
  PreviewRole,
  { label: string; personName: string; units: string[] | "all" }
> = {
  "super-admin": { label: "Super Admin", personName: "Khalid", units: "all" },
  "production-engineer": { label: "Production Engineer", personName: "Adeel", units: "all" },
  admin: { label: "Admin / Lead Operator", personName: "Majid", units: ["BF", "CF"] },
  operator: { label: "Operator", personName: "Sharjeel", units: ["BF"] },
};

export function isPreviewRole(value: string): value is PreviewRole {
  return value in ROLE_INFO;
}

export function canManageMachines(role: PreviewRole) {
  return role === "super-admin" || role === "production-engineer" || role === "admin";
}
export function canManageAccounts(role: PreviewRole) {
  return role === "super-admin" || role === "admin";
}
export function hasFullVisibility(role: PreviewRole) {
  return role === "super-admin" || role === "production-engineer";
}
export function canArchive(role: PreviewRole) {
  return role === "super-admin";
}
export function canConfigureAlerts(role: PreviewRole) {
  return role === "super-admin";
}

export const mockTasks = [
  { id: "1", unitCode: "BF", unitName: "B Flute", sectionCode: "RS-1", description: "Re-lubricate bearing of chuck shafts using grease gun", noOfPoints: 2, lubricationPoints: 4, frequencyLabel: "Weekly", lubricantName: "(Gadus) S2 V 220", badge: "working" as const, lastDone: "2026-08-25", nextDue: "2026-09-01" },
  { id: "2", unitCode: "BF", unitName: "B Flute", sectionCode: "QF-P (CF)", description: "Re-lubricate the corrugating roll bearings on both sides of machine", noOfPoints: 1, lubricationPoints: 12, frequencyLabel: "2 Weeks", lubricantName: "(Gleitmo 591)", badge: "due_soon" as const, lastDone: "2026-08-18", nextDue: "2026-09-01" },
  { id: "3", unitCode: "CF", unitName: "C Flute", sectionCode: "RS-2", description: "Re-lubricate bearing of pivot shafts on both sides using grease gun", noOfPoints: 2, lubricationPoints: 4, frequencyLabel: "2 Weeks", lubricantName: "(Gadus) S2 V 220", badge: "overdue" as const, lastDone: "2026-08-10", nextDue: "2026-08-24" },
  { id: "4", unitCode: "DF", unitName: "Double Facer", sectionCode: "HPH-A II", description: "Re-lubricate the pre heater bearing on both sides", noOfPoints: 18, lubricationPoints: 18, frequencyLabel: "Weekly", lubricantName: "(Gleitmo 591)", badge: "not_working" as const, lastDone: "2026-08-20", nextDue: "—" },
  { id: "5", unitCode: "DF", unitName: "Double Facer", sectionCode: "GU", description: "Re-lubricate bearing points of the doctor roll, using grease gun", noOfPoints: 16, lubricationPoints: 16, frequencyLabel: "Weekly", lubricantName: "(Gadus) S2 V 220", badge: "critical" as const, lastDone: "2026-08-05", nextDue: "2026-08-12" },
];

export const mockAlerts = [
  { id: "a1", type: "not_working", unit: "DF", section: "HPH-A II", description: "Pre heater bearing", when: "Today, 09:12", resolved: false },
  { id: "a2", type: "critical", unit: "DF", section: "GU", description: "Doctor roll bearing", when: "2 days ago", resolved: false },
  { id: "a3", type: "overdue", unit: "CF", section: "RS-2", description: "Pivot shaft bearing", when: "1 day ago", resolved: false },
  { id: "a4", type: "due_soon", unit: "BF", section: "QF-P (CF)", description: "Corrugating roll bearings", when: "3 hours ago", resolved: false },
  { id: "a5", type: "not_working", unit: "BF", section: "RS-1", description: "Chuck shaft bearing", when: "1 week ago", resolved: true },
];

export const mockAccounts = [
  { id: "u1", name: "Khalid", username: "khalid", role: "Super Admin", units: ["BF", "CF", "DF"] },
  { id: "u2", name: "Adeel", username: "adeel", role: "Production Engineer", units: ["BF", "CF", "DF"] },
  { id: "u3", name: "Majid", username: "majid", role: "Admin / Lead Operator", units: ["BF", "CF"] },
  { id: "u4", name: "Sharjeel", username: "sharjeel.bf", role: "Operator", units: ["BF"] },
  { id: "u5", name: "Tayyab", username: "tayyab.cf", role: "Operator", units: ["CF"] },
  { id: "u6", name: "Mubarak", username: "mubarak.df", role: "Operator", units: ["DF"] },
];

export const mockActivity = [
  { id: "l1", who: "Sharjeel", role: "operator", action: "inserted a record in task_status_events", when: "2 min ago" },
  { id: "l2", who: "Majid", role: "admin", action: "updated a record in tasks", when: "1 hour ago" },
  { id: "l3", who: "Adeel", role: "production_engineer", action: "inserted a record in event_annotations", when: "3 hours ago" },
  { id: "l4", who: "Khalid", role: "super_admin", action: "inserted a record in profiles", when: "Yesterday" },
  { id: "l5", who: "Tayyab", role: "operator", action: "inserted a record in task_status_events", when: "Yesterday" },
];

const byUnitTemplate = [
  { unitCode: "BF", onTrack: 14, dueSoon: 2, overdue: 1, critical: 0, notWorking: 1 },
  { unitCode: "CF", onTrack: 15, dueSoon: 1, overdue: 1, critical: 0, notWorking: 0 },
  { unitCode: "DF", onTrack: 12, dueSoon: 1, overdue: 1, critical: 1, notWorking: 1 },
];

export function scopedUnits(role: PreviewRole): string[] {
  const units = ROLE_INFO[role].units;
  return units === "all" ? ["BF", "CF", "DF"] : units;
}

export function mockAnalyticsFor(role: PreviewRole) {
  const allowed = new Set(scopedUnits(role));
  const byUnit = byUnitTemplate.filter((u) => allowed.has(u.unitCode));
  const totalTasks = byUnit.reduce((sum, u) => sum + u.onTrack + u.dueSoon + u.overdue + u.critical + u.notWorking, 0);
  const notWorkingCount = byUnit.reduce((sum, u) => sum + u.notWorking, 0);

  return {
    totalTasks,
    workingCount: totalTasks - notWorkingCount,
    notWorkingCount,
    byUnit,
    activityByDay: [
      { day: "08-24", checks: 6 }, { day: "08-25", checks: 9 }, { day: "08-26", checks: 4 },
      { day: "08-27", checks: 11 }, { day: "08-28", checks: 7 }, { day: "08-29", checks: 3 },
      { day: "08-30", checks: 8 }, { day: "08-31", checks: 5 },
    ],
    alertsByType: [
      { type: "due_soon", count: 4 }, { type: "overdue", count: 3 },
      { type: "critical", count: 1 }, { type: "not_working", count: 2 },
    ],
  };
}