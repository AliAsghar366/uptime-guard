import { NextResponse, type NextRequest } from "next/server";
import { evaluateTaskAlerts } from "@/lib/services/alert-sweep";

// Replaces the old pg_cron hourly schedule. Point an external scheduler at this endpoint
// (Windows Task Scheduler locally, Vercel Cron/GitHub Actions once deployed) with
// `Authorization: Bearer <CRON_SECRET>`.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await evaluateTaskAlerts();
  return NextResponse.json({ ok: true, ...result });
}