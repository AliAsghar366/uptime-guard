/**
 * One-time creation of the first Super Admin account, since there's no other way to log in to
 * a freshly-migrated database. Reads SUPER_ADMIN_USERNAME/SUPER_ADMIN_PASSWORD/
 * SUPER_ADMIN_FULL_NAME from .env.local -- unset them again once you've run this.
 * Run with: npm run db:create-super-admin
 */
import "./env";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const BCRYPT_ROUNDS = 12;

async function main() {
  const username = process.env.SUPER_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const fullName = process.env.SUPER_ADMIN_FULL_NAME?.trim();

  if (!username || !password || !fullName) {
    console.error("Set SUPER_ADMIN_USERNAME, SUPER_ADMIN_PASSWORD, and SUPER_ADMIN_FULL_NAME in .env.local first.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("SUPER_ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (existing.length > 0) {
    console.error(`A user named "${username}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await hash(password, BCRYPT_ROUNDS);
  await db.insert(users).values({ id: crypto.randomUUID(), username, fullName, role: "super_admin", passwordHash });

  console.log(`Created super_admin account "${username}". You can log in now -- unset SUPER_ADMIN_* in .env.local.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});