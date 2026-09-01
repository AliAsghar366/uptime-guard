import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";
import { SESSION_COOKIE_NAME as COOKIE_NAME } from "@/lib/auth/constants";

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// If a session has less than this much time left when seen, slide its expiry forward -- keeps
// active users logged in indefinitely without writing to the sessions table on every request.
const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, sessionCookieOptions(expiresAt));
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }

  cookieStore.delete(COOKIE_NAME);
}

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: (typeof users.$inferSelect)["role"];
}

export interface VerifiedSession {
  user: SessionUser;
  /** Non-null when the session was close to expiring and its DB row was just slid forward --
   *  callers that hold their own cookie handle (Proxy) need to reset the cookie's Max-Age too. */
  refreshedExpiry: Date | null;
}

/** Core token verification, independent of which cookie API the caller has available: Server
 *  Components/Actions use next/headers `cookies()` (see getSessionUser below), while Proxy
 *  (src/proxy.ts) uses NextRequest/NextResponse cookies instead -- both wrap this function.
 *  Returns null for a missing, expired, or unknown token. */
export async function verifySessionToken(token: string | undefined): Promise<VerifiedSession | null> {
  if (!token) return null;

  const tokenHash = hashToken(token);

  const rows = await db
    .select({
      expiresAt: sessions.expiresAt,
      userId: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    return null;
  }

  let refreshedExpiry: Date | null = null;
  if (row.expiresAt.getTime() - Date.now() < REFRESH_THRESHOLD_MS) {
    refreshedExpiry = new Date(Date.now() + SESSION_LIFETIME_MS);
    await db.update(sessions).set({ expiresAt: refreshedExpiry }).where(eq(sessions.tokenHash, tokenHash));
  }

  return {
    user: { id: row.userId, username: row.username, fullName: row.fullName, role: row.role },
    refreshedExpiry,
  };
}

/** Verifies the session cookie against the sessions table and returns the current user, or null.
 *  For use in Server Components/Actions (Node runtime, next/headers cookies available). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  const verified = await verifySessionToken(token);
  if (!verified) {
    if (token) cookieStore.delete(COOKIE_NAME);
    return null;
  }

  if (verified.refreshedExpiry) {
    cookieStore.set(COOKIE_NAME, token!, sessionCookieOptions(verified.refreshedExpiry));
  }

  return verified.user;
}

export { SESSION_COOKIE_NAME } from "@/lib/auth/constants";