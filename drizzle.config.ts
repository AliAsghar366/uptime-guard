import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set (see .env.local.example). Copy it to .env.local first.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./db/migrations/supabase",
  dbCredentials: { url: process.env.DATABASE_URL },
  verbose: true,
  strict: true,
});