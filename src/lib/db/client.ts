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
  //
  // max: 1, idle_timeout: 20 -- on a serverless host (Netlify/Vercel), every cold-started
  // function instance runs this module fresh and gets its own postgres.js connection pool.
  // postgres.js defaults to `max: 10` per pool, so a handful of concurrent invocations can
  // easily open 30-50+ connections against Supavisor's own (much smaller) free-tier connection
  // limit, causing exactly the symptom this fixes: random 500s on ordinary DB writes (login,
  // logout) once enough connections pile up, self-resolving only once idle ones eventually got
  // reaped. Supavisor already does the actual pooling across every serverless instance -- each
  // instance only ever needs to hold at most one upstream connection at a time; idle_timeout
  // releases it quickly instead of holding a pool slot through a frozen/idle container.
  return postgres(url, { prepare: false, max: 1, idle_timeout: 20 });
}

// Reused across hot-reloads in dev so we don't leak a new connection per edit.
const client = globalThis.__uptimeGuardClient ?? createClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__uptimeGuardClient = client;
}

export const db = drizzle(client, { schema });