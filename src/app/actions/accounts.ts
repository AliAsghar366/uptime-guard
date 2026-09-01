"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userUnitAssignments, users, type UserRole } from "@/lib/db/schema";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { assertAdminCanAssignRole, AuthorizationError } from "@/lib/auth/authorize";
import { logActivity } from "@/lib/services/activity-log";

export type ActionState = { error: string | null; success?: boolean };

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;
const VALID_ROLES: UserRole[] = ["super_admin", "production_engineer", "admin", "operator"];
const BCRYPT_ROUNDS = 12;

export async function createAccount(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await getCurrentProfile();
  if (!actor) return { error: "You must be signed in." };

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim().slice(0, 120);
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;
  const unitIds = formData.getAll("unitIds").map(String).filter(Boolean);

  if (!USERNAME_PATTERN.test(username)) {
    return { error: "Username must be 3-32 characters: lowercase letters, numbers, dots, underscores, or hyphens only." };
  }
  if (!fullName || password.length < 8 || !VALID_ROLES.includes(role)) {
    return { error: "All fields are required and the password must be at least 8 characters." };
  }

  try {
    await assertAdminCanAssignRole(actor, role, unitIds);
  } catch (err) {
    return { error: err instanceof AuthorizationError ? err.message : "You do not have permission to create accounts." };
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (existing.length > 0) {
    return { error: "Could not create account. Username may already be taken." };
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hash(password, BCRYPT_ROUNDS);

  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({ id: userId, username, fullName, role, passwordHash, createdBy: actor.id });
      await logActivity(tx, actor, "insert", "users", userId, null, { username, fullName, role });

      if (unitIds.length > 0) {
        await tx.insert(userUnitAssignments).values(
          unitIds.map((unitId) => ({ id: crypto.randomUUID(), userId, unitId, assignedBy: actor.id }))
        );
      }
    });
  } catch {
    return { error: "Could not create account. Username may already be taken." };
  }

  revalidatePath("/dashboard/accounts");
  return { error: null, success: true };
}

export async function revokeAssignment(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const rows = await db.select({ unitId: userUnitAssignments.unitId }).from(userUnitAssignments).where(eq(userUnitAssignments.id, id)).limit(1);
  const assignment = rows[0];
  if (!assignment) return;

  // Same rule as creating the assignment: super_admin unrestricted, admin only within units
  // they themselves have active scope over.
  try {
    await assertAdminCanAssignRole(actor, "operator", [assignment.unitId]);
  } catch {
    if (actor.role !== "super_admin" && actor.role !== "admin") return;
  }

  const revokedAt = new Date();
  await db.update(userUnitAssignments).set({ revokedAt }).where(eq(userUnitAssignments.id, id));
  await logActivity(db, actor, "update", "user_unit_assignments", id, null, { revokedAt });
  revalidatePath("/dashboard/accounts");
}

export async function assignUnit(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor) return;

  const userId = String(formData.get("userId") ?? "");
  const unitId = String(formData.get("unitId") ?? "");
  if (!userId || !unitId) return;

  const targetRows = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  const target = targetRows[0];
  if (!target) return;

  try {
    await assertAdminCanAssignRole(actor, target.role, [unitId]);
  } catch {
    return;
  }

  const id = crypto.randomUUID();
  await db.insert(userUnitAssignments).values({ id, userId, unitId, assignedBy: actor.id });
  await logActivity(db, actor, "insert", "user_unit_assignments", id, null, { userId, unitId });
  revalidatePath("/dashboard/accounts");
}