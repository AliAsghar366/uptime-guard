import { createClient } from "@supabase/supabase-js";

export type StorageBucket = "reference-photos" | "task-photos";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set (see .env.local.example).");
  }
  // service_role bypasses Storage's RLS entirely -- safe here because this client is only ever
  // used server-side, from code that has already done its own session + unit-scope check
  // (src/app/actions/*.ts, src/app/api/files/[bucket]/[...path]/route.ts), never sent to the browser.
  return createClient(url, key, { auth: { persistSession: false } });
}

declare global {
  var __uptimeGuardSupabase: ReturnType<typeof createAdminClient> | undefined;
}

const supabaseAdmin = globalThis.__uptimeGuardSupabase ?? createAdminClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__uptimeGuardSupabase = supabaseAdmin;
}

/** Same filename-sanitization rule as before: strips anything unsafe to appear in a path
 *  segment, since the result becomes part of the storage object key AND the URL the files route
 *  re-parses to authorize access to (taskId is the first segment). */
export function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

export function isAcceptableImage(file: File) {
  return file.size > 0 && file.size <= MAX_PHOTO_BYTES && file.type.startsWith("image/");
}

/** Uploads a photo to the <bucket>/<taskId>/<timestamp>-<safeName> object key and returns that
 *  relative path, stored in the DB (picture_url / photo_url) -- src/app/api/files/[bucket]/
 *  [...path]/route.ts re-derives taskId from this path's first segment to authorize reads, then
 *  fetches the bytes from Supabase Storage using the same admin client. */
export async function saveUploadedPhoto(bucket: StorageBucket, taskId: string, file: File): Promise<string> {
  const safeName = sanitizeFilename(file.name);
  const relativePath = `${taskId}/${Date.now()}-${safeName}`;

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(relativePath, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  if (error) {
    throw new Error(`Failed to upload photo to Supabase Storage: ${error.message}`);
  }

  return relativePath;
}

/** Downloads a stored photo's bytes + content-type, for src/app/api/files/... to stream back
 *  after its own auth check -- the bucket stays private, so this is the only read path. */
export async function downloadStoredPhoto(bucket: StorageBucket, relativePath: string) {
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(relativePath);
  if (error || !data) {
    throw new Error(error?.message ?? "Photo not found");
  }
  return { buffer: Buffer.from(await data.arrayBuffer()), contentType: data.type };
}

/** Same-origin URL for a stored photo, served by the authenticated files route. */
export function fileUrl(bucket: StorageBucket, relativePath: string) {
  return `/api/files/${bucket}/${relativePath}`;
}