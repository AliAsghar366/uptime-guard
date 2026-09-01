import { redirect } from "next/navigation";
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
  LogOut,
} from "lucide-react";
import { getCurrentProfile, canManageMachines, canManageAccounts, hasFullVisibility } from "@/lib/auth/current-profile";
import { logout } from "@/app/actions/auth";
import { LogoMark } from "@/components/logo-mark";
import type { UserRole } from "@/lib/db/schema";

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  production_engineer: "Production Engineer",
  admin: "Admin / Lead Operator",
  operator: "Operator",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/");
  }

  const navItems = [
    { href: "/dashboard/tasks", label: "Tasks", icon: ClipboardCheck, show: true },
    { href: "/dashboard/alerts", label: "Alerts", icon: Bell, show: true },
    { href: "/dashboard/machines", label: "Machines", icon: Cog, show: canManageMachines(profile.role) },
    { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, show: true },
    { href: "/dashboard/accounts", label: "Accounts", icon: Users, show: canManageAccounts(profile.role) },
    { href: "/dashboard/activity", label: "Activity Log", icon: History, show: hasFullVisibility(profile.role) },
    { href: "/dashboard/reports", label: "Reports", icon: FileDown, show: canManageMachines(profile.role) },
    { href: "/dashboard/settings", label: "Alert Settings", icon: SlidersHorizontal, show: profile.role === "super_admin" },
  ].filter((item) => item.show);

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="glass-panel m-3 flex w-60 shrink-0 flex-col p-4">
        <div className="flex items-center gap-2 px-1 pb-6">
          <LogoMark size={32} />
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
          <div className="text-sm font-medium text-white">{profile.fullName}</div>
          <div className="status-pill status-pill--working w-fit">{ROLE_LABELS[profile.role]}</div>
          <form action={logout}>
            <button
              type="submit"
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/8 hover:text-white"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}