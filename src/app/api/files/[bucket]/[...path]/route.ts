import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sections, tasks, units } from "@/lib/db/schema";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { hasUnitScope } from "@/lib/auth/authorize";
import { downloadStoredPhoto, type StorageBucket } from "@/lib/storage/supabase";

const ALLOWED_BUCKETS = new Set<StorageBucket>(["reference-photos", "task-photos"]);

// Path convention is `<bucket>/<taskId>/<filename>`, matching the Supabase Storage object key
// layout -- taskId is re-derived from the URL and checked against the caller's unit scope on
// every request (the same authorization the old Postgres RLS storage policies enforced via
// storage.foldername(name)). The bucket itself stays private; this route is the only read path.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bucket: string; path: string[] }> }
) {
  const { bucket, path: pathSegments } = await params;

  if (!ALLOWED_BUCKETS.has(bucket as StorageBucket) || pathSegments.length < 2) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const actor = await getCurrentProfile();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [taskId, ...rest] = pathSegments;
  if (taskId.includes("..") || rest.some((segment) => segment.includes("..") || /[\\/]/.test(segment))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const taskRows = await db
    .select({ unitId: units.id })
    .from(tasks)
    .innerJoin(sections, eq(sections.id, tasks.sectionId))
    .innerJoin(units, eq(units.id, sections.unitId))
    .where(eq(tasks.id, taskId))
    .limit(1);

  const task = taskRows[0];
  if (!task || !(await hasUnitScope(actor, task.unitId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let photo: Awaited<ReturnType<typeof downloadStoredPhoto>>;
  try {
    photo = await downloadStoredPhoto(bucket as StorageBucket, [taskId, ...rest].join("/"));
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(photo.buffer), {
    headers: { "Content-Type": photo.contentType, "Cache-Control": "private, max-age=3600" },
  });
}