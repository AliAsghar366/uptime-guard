import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

declare global {
  var __uptimeGuardPool: mysql.Pool | undefined;
}

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set (see .env.local.example).");
  }
  return mysql.createPool(url);
}

// Reused across hot-reloads in dev so we don't leak a new connection pool per edit.
const pool = globalThis.__uptimeGuardPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  globalThis.__uptimeGuardPool = pool;
}

export const db = drizzle(pool, { schema, mode: "default" });