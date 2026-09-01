import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ClipboardCheck,
  Bell,
  Cog,
  BarChart3,
  Users,
  History,
  FileDown,
  SlidersHorizontal,
} from "lucide-react";
import {
  isPreviewRole,
  ROLE_INFO,
  canManageMachines,
  canManageAccounts,
  hasFullVisibility,
  canConfigureAlerts,
} from "../mock-data";

export default async function PreviewRoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  if (!isPreviewRole(role)) notFound();

  const info = ROLE_INFO[role];

  const navItems = [
    { href: `/preview/${role}/tasks`, label: "Tasks", icon: ClipboardCheck, show: true },
    { href: `/preview/${role}/alerts`, label: "Alerts", icon: Bell, show: true },
    { href: `/preview/${role}/machines`, label: "Machines", icon: Cog, show: canManageMachines(role) },
    { href: `/preview/${role}/analytics`, label: "Analytics", icon: BarChart3, show: true },
    { href: `/preview/${role}/accounts`, label: "Accounts", icon: Users, show: canManageAccounts(role) },
    { href: `/preview/${role}/activity`, label: "Activity Log", icon: History, show: hasFullVisibility(role) },
    { href: `/preview/${role}/reports`, label: "Reports", icon: FileDown, show: canManageMachines(role) },
    { href: `/preview/${role}/settings`, label: "Alert Settings", icon: SlidersHorizontal, show: canConfigureAlerts(role) },
  ].filter((item) => item.show);

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <div className="bg-[var(--color-status-due-soon)]/90 px-4 py-1.5 text-center text-xs font-semibold text-navy-950">
        PREVIEW MODE — fake data, not connected to the database — viewing as {info.label}
      </div>

      <div className="flex flex-1">
        <aside className="glass-panel m-3 flex w-60 shrink-0 flex-col p-4">
          <div className="flex items-center gap-2 px-1 pb-6">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[var(--color-brand-blue)] to-[var(--color-brand-teal)]" />
            <span className="text-sm font-semibold text-white">Uptime Guard</span>
          </div>

          <nav className="flex flex-1 flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/75 transition-colors hover:bg-white/8 hover:text-white"
              >
                <item.icon size={16} strokeWidth={2} />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="glass-input mt-4 flex flex-col gap-2 p-3">
            <div className="text-sm font-medium text-white">{info.personName}</div>
            <div className="status-pill status-pill--working w-fit">{info.label}</div>
            <Link
              href="/preview"
              className="mt-1 w-full rounded-lg border border-white/15 px-3 py-1.5 text-center text-xs text-white/70 transition-colors hover:bg-white/8 hover:text-white"
            >
              Switch role
            </Link>
          </div>
        </aside>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}