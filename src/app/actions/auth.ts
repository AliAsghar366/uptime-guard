"use server";

import { redirect } from "next/navigation";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { createSession, destroySession } from "@/lib/auth/session";

export type LoginState = { error: string | null };

const GENERIC_LOGIN_ERROR = "Invalid username or password.";

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const user = rows[0];

  // Same generic message whether the username doesn't exist or the password is wrong -- never
  // reveal which one, that's an enumeration/leak vector on a login form.
  if (!user || !(await compare(password, user.passwordHash))) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}