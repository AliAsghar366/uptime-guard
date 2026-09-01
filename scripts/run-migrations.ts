import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./db/migrations/supabase" });
  await client.end();
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});