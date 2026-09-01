import type { Config } from "@netlify/functions";

// Netlify's equivalent of vercel.json's `crons` entry -- Scheduled Functions don't ping an
// existing app route on their own the way Vercel Cron does, and Netlify doesn't auto-inject an
// Authorization header either, so this function does both explicitly: calls the real
// alert-sweep logic at src/app/api/cron/evaluate-alerts/route.ts (the single source of truth,
// same route used locally / on Vercel), authenticated the same way an external scheduler always
// has been for this endpoint.
export default async () => {
  const siteUrl = process.env.URL; // Netlify's own env var: this site's production URL
  const secret = process.env.CRON_SECRET;

  if (!siteUrl || !secret) {
    console.error("alert-sweep: URL or CRON_SECRET not set, skipping.");
    return new Response("Missing URL or CRON_SECRET", { status: 500 });
  }

  const res = await fetch(`${siteUrl}/api/cron/evaluate-alerts`, {
    method: "GET",
    headers: { Authorization: `Bearer ${secret}` },
  });

  const body = await res.text();
  console.log(`alert-sweep: ${res.status} ${body}`);

  return new Response(body, { status: res.status });
};

export const config: Config = {
  schedule: "0 * * * *", // hourly, same cadence as vercel.json
};