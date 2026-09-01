import { mkdir, writeFile } from "node:fs/promises";
import nodePath from "node:path";

export type StorageBucket = "reference-photos" | "task-photos";

export const UPLOADS_ROOT = nodePath.join(process.cwd(), "uploads");
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Same filename-sanitization rule as before: strips anything unsafe to appear in a path
 *  segment, since the result becomes part of the on-disk path AND the URL the files route
 *  re-parses to authorize access to (taskId is the first segment). */
export function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

export function isAcceptableImage(file: File) {
  return file.size > 0 && file.size <= MAX_PHOTO_BYTES && file.type.startsWith("image/");
}

/** Writes an uploaded photo to uploads/<bucket>/<taskId>/<timestamp>-<safeName> and returns the
 *  relative path stored in the DB (picture_url / photo_url) -- same convention the old Supabase
 *  Storage upload used, since src/app/api/files/[bucket]/[...path]/route.ts re-derives taskId
 *  from this path's first segment to authorize reads. */
export async function saveUploadedPhoto(bucket: StorageBucket, taskId: string, file: File): Promise<string> {
  const safeName = sanitizeFilename(file.name);
  const relativePath = `${taskId}/${Date.now()}-${safeName}`;
  const absoluteDir = nodePath.join(UPLOADS_ROOT, bucket, taskId);
  const absolutePath = nodePath.join(UPLOADS_ROOT, bucket, relativePath);

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return relativePath;
}

/** Same-origin URL for a stored photo, served by the authenticated files route. */
export function fileUrl(bucket: StorageBucket, relativePath: string) {
  return `/api/files/${bucket}/${relativePath}`;
}