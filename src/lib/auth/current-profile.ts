import { getSessionUser } from "@/lib/auth/session";
import type { UserRole } from "@/lib/db/schema";

export interface CurrentProfile {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
}

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const user = await getSessionUser();
  if (!user) return null;

  return { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
}

export {
  FULL_VISIBILITY_ROLES,
  CONFIG_ROLES,
  canManageMachines,
  canManageAccounts,
  hasFullVisibility,
} from "@/lib/auth/authorize";