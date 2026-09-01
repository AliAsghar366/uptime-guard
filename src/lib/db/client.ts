import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __uptimeGuardClient: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set (see .env.local.example).");
  }
  // prepare: false -- required against Supabase's connection pooler (Supavisor), which
  // multiplexes connections and doesn't support server-side prepared statements the way a
  // direct connection does.
  return postgres(url, { prepare: false });
}

// Reused across hot-reloads in dev so we don't leak a new connection per edit.
const client = globalThis.__uptimeGuardClient ?? createClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__uptimeGuardClient = client;
}

export const db = drizzle(client, { schema });