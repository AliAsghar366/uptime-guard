import { and, Column, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userUnitAssignments, type UserRole } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/auth/session";

export const FULL_VISIBILITY_ROLES: UserRole[] = ["super_admin", "production_engineer"];
export const CONFIG_ROLES: UserRole[] = ["super_admin", "production_engineer", "admin"];

export function hasFullVisibility(role: UserRole) {
  return FULL_VISIBILITY_ROLES.includes(role);
}

export function canManageMachines(role: UserRole) {
  return CONFIG_ROLES.includes(role);
}

export function canManageAccounts(role: UserRole) {
  return role === "super_admin" || role === "admin";
}

/** Port of has_unit_scope(uid, target_unit): full-visibility roles see everything; everyone
 *  else needs an active (non-revoked) assignment to that specific unit. */
export async function hasUnitScope(actor: SessionUser, unitId: string): Promise<boolean> {
  if (hasFullVisibility(actor.role)) return true;

  const rows = await db
    .select({ id: userUnitAssignments.id })
    .from(userUnitAssignments)
    .where(
      and(
        eq(userUnitAssignments.userId, actor.id),
        eq(userUnitAssignments.unitId, unitId),
        isNull(userUnitAssignments.revokedAt)
      )
    )
    .limit(1);

  return rows.length > 0;
}

/** Returns "all" for full-visibility roles, otherwise the explicit list of unit ids the actor
 *  currently has active access to. Callers use this to build a `WHERE unit_id IN (...)` filter
 *  -- this function is the single reusable stand-in for every RLS policy that used
 *  has_unit_scope()/is_full_visibility_role() in the old schema. */
export async function scopedUnitIds(actor: SessionUser): Promise<"all" | string[]> {
  if (hasFullVisibility(actor.role)) return "all";

  const rows = await db
    .select({ unitId: userUnitAssignments.unitId })
    .from(userUnitAssignments)
    .where(and(eq(userUnitAssignments.userId, actor.id), isNull(userUnitAssignments.revokedAt)));

  return rows.map((r) => r.unitId);
}

/** Helper for building a Drizzle `where` filter on a unit-id column from a scopedUnitIds()
 *  result. Returns undefined when scope is "all" (no filter needed). If the unit list is empty,
 *  callers should short-circuit to an empty result set rather than run the query, since
 *  `inArray(column, [])` is not a reliable "match nothing" filter across drivers. */
export function unitScopeCondition(column: Column, scope: "all" | string[]) {
  if (scope === "all") return undefined;
  return inArray(column, scope);
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have access to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function assertCanManageMachines(actor: SessionUser) {
  if (!canManageMachines(actor.role)) {
    throw new AuthorizationError("Only Admin tier and above can manage machines.");
  }
}

export function assertCanManageAccounts(actor: SessionUser) {
  if (!canManageAccounts(actor.role)) {
    throw new AuthorizationError("Only Super Admin or Admin can manage accounts.");
  }
}

/** Port of the annotations_insert RLS policy: author_id = auth.uid() AND role in
 *  (super_admin, production_engineer, admin). */
export function assertCanAnnotate(actor: SessionUser) {
  if (!CONFIG_ROLES.includes(actor.role)) {
    throw new AuthorizationError("Only Admin tier and above can comment.");
  }
}

/** Port of the status_events_insert RLS policy: recorded_by = auth.uid() AND unit-scoped. */
export async function assertCanRecordStatus(actor: SessionUser, unitId: string) {
  if (!(await hasUnitScope(actor, unitId))) {
    throw new AuthorizationError("You may not have access to this task.");
  }
}

/** Port of the profiles_insert / assignments_insert RLS policies: super_admin is unrestricted;
 *  admin may only create/assign accounts with role = "operator", and only within units they
 *  themselves have active scope over. */
export async function assertAdminCanAssignRole(
  actor: SessionUser,
  targetRole: UserRole,
  unitIds: string[]
) {
  if (actor.role === "super_admin") return;

  if (actor.role !== "admin") {
    throw new AuthorizationError("Only Super Admin or Admin can create accounts.");
  }

  if (targetRole !== "operator") {
    throw new AuthorizationError("Admins may only create Operator accounts.");
  }

  for (const unitId of unitIds) {
    if (!(await hasUnitScope(actor, unitId))) {
      throw new AuthorizationError("You do not have access to one of the selected units.");
    }
  }
}

/** Port of prevent_self_privilege_escalation(): a non-super_admin editing their own account may
 *  not change their own role or username. */
export function assertNoSelfPrivilegeEscalation(
  actor: SessionUser,
  targetUserId: string,
  changes: { role?: UserRole; username?: string }
) {
  if (actor.role === "super_admin" || targetUserId !== actor.id) return;

  if ((changes.role && changes.role !== actor.role) || (changes.username && changes.username !== actor.username)) {
    throw new AuthorizationError("Only Super Admin may change role or username.");
  }
}

/** Port of units_insert RLS: unlike sections/tasks, unit creation is NOT open to "admin" --
 *  only super_admin/production_engineer. */
export function assertCanCreateUnit(actor: SessionUser) {
  if (!FULL_VISIBILITY_ROLES.includes(actor.role)) {
    throw new AuthorizationError("Only Super Admin or Production Engineer can add a new machine.");
  }
}

/** Port of units_update RLS: archiving a unit is super_admin only. */
export function assertCanArchiveUnit(actor: SessionUser) {
  if (actor.role !== "super_admin") {
    throw new AuthorizationError("Only Super Admin can archive a machine.");
  }
}

/** Port of sections_write/sections_update/tasks_write/tasks_update RLS: admin-tier role AND
 *  unit-scoped to the specific unit being written to. */
export async function assertCanManageUnitScopedRecord(actor: SessionUser, unitId: string) {
  if (!CONFIG_ROLES.includes(actor.role)) {
    throw new AuthorizationError("Only Admin tier and above can manage machines.");
  }
  if (!(await hasUnitScope(actor, unitId))) {
    throw new AuthorizationError("You do not have access to this unit.");
  }
}

/** Port of lubricants_write RLS: admin-tier role, not unit-scoped (lubricants are shared
 *  reference data). */
export function assertCanManageLubricants(actor: SessionUser) {
  if (!CONFIG_ROLES.includes(actor.role)) {
    throw new AuthorizationError("Only Admin tier and above can manage lubricants.");
  }
}