/**
 * One-time import of the reviewed BF/CF/DF task data.
 * Run with: npm run db:import-tasks
 *
 * Prerequisites:
 *  1. db/migrations/*.sql have been applied (npm run db:migrate).
 *  2. db/seed/units-sections-lubricants.ts has been run (creates units/sections/lubricants).
 *  3. db/seed/tasks_reference.json has been reviewed/corrected by a human against the source
 *     PDFs (two rows are flagged `_flag` for possible accidental duplication).
 */
import "./env";
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { lubricants, sections, tasks, units } from "@/lib/db/schema";

const FREQUENCY_DAYS: Record<string, number> = { Weekly: 7, "2 Weeks": 14, Monthly: 30 };

interface TaskRow {
  section: string;
  description: string;
  noOfPoints: number;
  frequencyLabel: string;
  lubricant: string;
  lubricationPoints: number;
}

async function importUnit(unitCode: string, rows: TaskRow[]) {
  const unitRows = await db.select({ id: units.id }).from(units).where(eq(units.code, unitCode)).limit(1);
  const unit = unitRows[0];

  if (!unit) {
    console.error(`Unit ${unitCode} not found -- run units-sections-lubricants.ts first.`);
    return;
  }

  const lubricantRows = await db.select({ id: lubricants.id, name: lubricants.name }).from(lubricants);
  const lubricantByName = new Map(lubricantRows.map((l) => [l.name, l.id]));

  for (const row of rows) {
    const sectionRows = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.unitId, unit.id), eq(sections.code, row.section)))
      .limit(1);
    const section = sectionRows[0];

    if (!section) {
      console.error(`  Section ${row.section} not found under ${unitCode}, skipping: ${row.description}`);
      continue;
    }

    try {
      await db.insert(tasks).values({
        id: crypto.randomUUID(),
        sectionId: section.id,
        description: row.description,
        noOfPoints: row.noOfPoints,
        lubricationPoints: row.lubricationPoints,
        frequencyLabel: row.frequencyLabel,
        frequencyDays: FREQUENCY_DAYS[row.frequencyLabel] ?? 7,
        lubricantId: lubricantByName.get(row.lubricant) ?? null,
      });
      console.log(`  + [${unitCode}/${row.section}] ${row.description}`);
    } catch (err) {
      console.error(`  Failed to insert "${row.description}":`, err);
    }
  }
}

async function main() {
  const raw = readFileSync(new URL("./tasks_reference.json", import.meta.url), "utf-8");
  const data = JSON.parse(raw) as { BF: TaskRow[]; DF: TaskRow[] };

  console.log("Importing BF...");
  await importUnit("BF", data.BF);

  console.log("Importing CF (same rows as BF)...");
  await importUnit("CF", data.BF);

  console.log("Importing DF...");
  await importUnit("DF", data.DF);

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});