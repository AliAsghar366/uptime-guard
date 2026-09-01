/**
 * High-confidence structural seed data, directly transcribed from the 3 source PDFs
 * (B flute.pdf, C flute.pdf, double facer.pdf). Safe to run as-is once migrations have been
 * applied -- this is just the skeleton (units, sections, lubricant types), not the individual
 * task rows (see import-tasks.ts / tasks_reference.json for those).
 *
 * Run with: npm run db:seed
 */
import "./env";
import { db } from "@/lib/db/client";
import { lubricants, sections, units } from "@/lib/db/schema";

const UNITS = [
  { code: "BF", name: "B Flute" },
  { code: "CF", name: "C Flute" },
  { code: "DF", name: "Double Facer" },
];

const LUBRICANTS = ["(Gadus) S2 V 220", "(Gleitmo 591)"];

// CF has section codes identical to BF in the source sheets.
const SECTIONS: Record<string, string[]> = {
  BF: ["RS-1", "RS-2", "SP-X 1", "HPA-A", "QF-P (CF)"],
  CF: ["RS-1", "RS-2", "SP-X 1", "HPA-A", "QF-P (CF)"],
  DF: ["RS-1", "B-II", "GU", "HPH-A II"],
};

async function main() {
  const unitIds: Record<string, string> = {};

  for (const u of UNITS) {
    const id = crypto.randomUUID();
    await db.insert(units).values({ id, code: u.code, name: u.name });
    unitIds[u.code] = id;
    console.log(`  + unit ${u.code}`);
  }

  for (const name of LUBRICANTS) {
    await db.insert(lubricants).values({ id: crypto.randomUUID(), name });
    console.log(`  + lubricant ${name}`);
  }

  for (const [unitCode, codes] of Object.entries(SECTIONS)) {
    for (const code of codes) {
      await db.insert(sections).values({ id: crypto.randomUUID(), unitId: unitIds[unitCode], code });
      console.log(`  + section ${unitCode}/${code}`);
    }
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});