import { redirect } from "next/navigation";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getCurrentProfile, canManageAccounts, hasFullVisibility } from "@/lib/auth/current-profile";
import { scopedUnitIds } from "@/lib/auth/authorize";
import { db } from "@/lib/db/client";
import { units, userUnitAssignments, users } from "@/lib/db/schema";
import { CreateAccountForm } from "@/components/create-account-form";
import { revokeAssignment, assignUnit } from "@/app/actions/accounts";

export default async function AccountsPage() {
  const profile = await getCurrentProfile();
  if (!profile || !canManageAccounts(profile.role)) {
    redirect("/dashboard/tasks");
  }

  const scope = await scopedUnitIds(profile);

  const unitRows =
    scope === "all"
      ? await db.select({ id: units.id, code: units.code, name: units.name }).from(units).where(isNull(units.archivedAt)).orderBy(units.code)
      : scope.length > 0
        ? await db
            .select({ id: units.id, code: units.code, name: units.name })
            .from(units)
            .where(and(isNull(units.archivedAt), inArray(units.id, scope)))
            .orderBy(units.code)
        : [];

  // Port of the profiles_select RLS policy: full-visibility roles see everyone; an admin sees
  // themselves plus anyone who shares an active unit assignment with them.
  let visibleUserIds: "all" | string[] = "all";
  if (!hasFullVisibility(profile.role)) {
    const sharedRows =
      scope === "all" || scope.length === 0
        ? []
        : await db
            .select({ userId: userUnitAssignments.userId })
            .from(userUnitAssignments)
            .where(and(inArray(userUnitAssignments.unitId, scope), isNull(userUnitAssignments.revokedAt)));
    visibleUserIds = [...new Set([profile.id, ...sharedRows.map((r) => r.userId)])];
  }

  const accountRows =
    visibleUserIds === "all"
      ? await db.select({ id: users.id, username: users.username, fullName: users.fullName, role: users.role }).from(users).orderBy(users.fullName)
      : await db
          .select({ id: users.id, username: users.username, fullName: users.fullName, role: users.role })
          .from(users)
          .where(inArray(users.id, visibleUserIds))
          .orderBy(users.fullName);

  const assignmentRows =
    accountRows.length > 0
      ? await db
          .select({
            id: userUnitAssignments.id,
            userId: userUnitAssignments.userId,
            revokedAt: userUnitAssignments.revokedAt,
            unitId: units.id,
            unitCode: units.code,
          })
          .from(userUnitAssignments)
          .innerJoin(units, eq(units.id, userUnitAssignments.unitId))
          .where(inArray(userUnitAssignments.userId, accountRows.map((a) => a.id)))
      : [];

  const assignmentsByUser = new Map<string, typeof assignmentRows>();
  for (const a of assignmentRows) {
    const list = assignmentsByUser.get(a.userId) ?? [];
    list.push(a);
    assignmentsByUser.set(a.userId, list);
  }

  const accounts = accountRows.map((account) => ({ ...account, assignments: assignmentsByUser.get(account.id) ?? [] }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Accounts</h1>

      <CreateAccountForm units={unitRows} canAssignAllRoles={profile.role === "super_admin"} />

      <div className="glass-panel flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold text-white">All Accounts</h2>
        <div className="flex flex-col gap-3">
          {accounts.map((account) => {
            const activeUnits = account.assignments.filter((a) => !a.revokedAt);
            return (
              <div key={account.id} className="glass-input flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <span className="text-sm font-medium text-white">{account.fullName}</span>{" "}
                  <span className="text-xs text-white/40">@{account.username}</span>{" "}
                  <span className="status-pill status-pill--neutral ml-2 capitalize">
                    {account.role.replace("_", " ")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {activeUnits.map((a) => (
                    <form key={a.id} action={revokeAssignment}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        title="Click to revoke"
                        className="status-pill status-pill--working hover:opacity-70"
                      >
                        {a.unitCode} ×
                      </button>
                    </form>
                  ))}
                  <form action={assignUnit} className="flex items-center gap-1">
                    <input type="hidden" name="userId" value={account.id} />
                    <select name="unitId" className="glass-input px-2 py-1 text-[11px] text-white">
                      {unitRows
                        .filter((u) => !activeUnits.some((a) => a.unitId === u.id))
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.code}
                          </option>
                        ))}
                    </select>
                    <button className="rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/70 hover:bg-white/8">
                      + Assign
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}