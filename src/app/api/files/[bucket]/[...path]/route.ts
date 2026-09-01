import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import nodePath from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sections, tasks, units } from "@/lib/db/schema";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { hasUnitScope } from "@/lib/auth/authorize";
import { UPLOADS_ROOT, type StorageBucket } from "@/lib/storage/local";

const ALLOWED_BUCKETS = new Set<StorageBucket>(["reference-photos", "task-photos"]);

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

// Replaces Supabase Storage's signed URLs. Path convention is `<bucket>/<taskId>/<filename>`,
// same as the old `storage.objects` layout -- taskId is re-derived from the URL and checked
// against the caller's unit scope on every request (the same authorization the old storage
// RLS policies enforced via storage.foldername(name)).
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

  const absolutePath = nodePath.join(UPLOADS_ROOT, bucket, taskId, ...rest);
  if (!absolutePath.startsWith(nodePath.join(UPLOADS_ROOT, bucket))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(absolutePath);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contentType = CONTENT_TYPES[nodePath.extname(absolutePath).toLowerCase()] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" },
  });
}