import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "@/lib/db/client";
import { sections, taskStatusEvents, tasks, units, users } from "@/lib/db/schema";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { scopedUnitIds } from "@/lib/auth/authorize";

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get("format") ?? "csv";

  // RLS used to scope this to the caller's visible units automatically -- that filter has to
  // be explicit here now.
  const scope = await scopedUnitIds(profile);

  const rows =
    scope === "all" || scope.length > 0
      ? await db
          .select({
            createdAt: taskStatusEvents.createdAt,
            status: taskStatusEvents.status,
            comment: taskStatusEvents.comment,
            taskDescription: tasks.description,
            sectionCode: sections.code,
            unitCode: units.code,
            recordedByName: users.fullName,
          })
          .from(taskStatusEvents)
          .innerJoin(tasks, eq(tasks.id, taskStatusEvents.taskId))
          .innerJoin(sections, eq(sections.id, tasks.sectionId))
          .innerJoin(units, eq(units.id, sections.unitId))
          .innerJoin(users, eq(users.id, taskStatusEvents.recordedBy))
          .where(scope === "all" ? undefined : inArray(units.id, scope))
          .orderBy(desc(taskStatusEvents.createdAt))
          .limit(2000)
      : [];

  const tableRows = rows.map((r) => [
    r.createdAt.toLocaleString("en-GB"),
    r.unitCode,
    r.sectionCode,
    r.taskDescription,
    r.status === "working" ? "OK" : "NOT WORKING",
    r.recordedByName,
    r.comment ?? "",
  ]);

  if (format === "pdf") {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Uptime Guard - Maintenance Report", 14, 15);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString("en-GB")} by ${profile.fullName}`, 14, 21);

    autoTable(doc, {
      startY: 26,
      head: [["Date", "Unit", "Section", "Task", "Status", "By", "Comment"]],
      body: tableRows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [11, 30, 51] },
    });

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="uptime-guard-report-${Date.now()}.pdf"`,
      },
    });
  }

  const header = ["Date", "Unit", "Section", "Task", "Status", "By", "Comment"];
  const csv = [header, ...tableRows]
    .map((row) => row.map((cell) => csvEscape(String(cell))).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="uptime-guard-report-${Date.now()}.csv"`,
    },
  });
}