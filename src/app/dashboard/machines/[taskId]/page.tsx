import Image from "next/image";
import { notFound } from "next/navigation";
import { Siren } from "lucide-react";
import { getMachineProfile } from "@/lib/data/machine-profile";
import { getCurrentProfile, canManageMachines } from "@/lib/auth/current-profile";
import { fileUrl } from "@/lib/storage/local";
import { EventAnnotationForm } from "@/components/event-annotation-form";
import { ReferencePhotoThumb } from "@/components/reference-photo-thumb";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MachineProfilePage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const [profile, machine] = await Promise.all([getCurrentProfile(), getMachineProfile(taskId)]);

  if (!machine) notFound();

  const referencePhotoUrl = machine.pictureUrl ? fileUrl("reference-photos", machine.pictureUrl) : null;
  const canComment = profile ? canManageMachines(profile.role) : false;

  return (
    <div className="flex flex-col gap-6">
      <div className="glass-panel flex flex-col gap-4 p-6 md:flex-row">
        <ReferencePhotoThumb
          photoUrl={referencePhotoUrl}
          markerX={machine.markerX}
          markerY={machine.markerY}
          alt={machine.description}
          size={160}
          pinSize={32}
        />
        <div className="flex flex-1 flex-col gap-2">
          <div className="text-xs uppercase tracking-wide text-white/40">
            {machine.unitName} ({machine.unitCode}) · {machine.sectionCode}
            {machine.archivedAt ? " · Archived" : ""}
          </div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
            {machine.isCritical ? (
              <span className="status-pill status-pill--critical">
                <Siren size={12} /> Critical
              </span>
            ) : null}
            {machine.description}
          </h1>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/60 sm:grid-cols-4">
            <span>Points: {machine.noOfPoints}</span>
            <span>Lube points: {machine.lubricationPoints}</span>
            <span>Frequency: {machine.frequencyLabel}</span>
            <span>Lubricant: {machine.lubricantName ?? "—"}</span>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6">
        <h2 className="mb-4 text-sm font-semibold text-white">Full History Timeline</h2>

        {machine.events.length === 0 ? (
          <p className="text-sm text-white/50">No status has been recorded for this point yet.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {machine.events.map((event) => {
              const photoUrl = event.photoUrl ? fileUrl("task-photos", event.photoUrl) : null;
              return (
                <li key={event.id} className="glass-input p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`status-pill ${
                        event.status === "working" ? "status-pill--working" : "status-pill--critical"
                      }`}
                    >
                      {event.status === "working" ? "Marked OK" : "Marked Not Working"}
                    </span>
                    <span className="text-xs text-white/40">{formatDateTime(event.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-white/80">
                    by <span className="font-medium">{event.recordedByName}</span>{" "}
                    <span className="text-white/40">({event.recordedByRole})</span>
                  </p>
                  {event.comment ? (
                    <p className="mt-1 text-sm text-white/60">&ldquo;{event.comment}&rdquo;</p>
                  ) : null}
                  {photoUrl ? (
                    // unoptimized: same reason as ReferencePhotoThumb -- /api/files/... is
                    // session-gated and Next's Image Optimizer can't carry that cookie.
                    <Image
                      src={photoUrl}
                      alt="Check-off proof"
                      width={200}
                      height={150}
                      className="mt-2 rounded-lg object-cover"
                      unoptimized
                    />
                  ) : null}

                  {event.annotations.length > 0 ? (
                    <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3">
                      {event.annotations.map((a) => (
                        <p key={a.id} className="text-xs text-white/60">
                          <span className="font-medium text-white/80">{a.authorName}:</span> {a.body}{" "}
                          <span className="text-white/30">({formatDateTime(a.createdAt)})</span>
                        </p>
                      ))}
                    </div>
                  ) : null}

                  {canComment ? <EventAnnotationForm eventId={event.id} /> : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="glass-panel p-6">
        <h2 className="mb-4 text-sm font-semibold text-white">Alert History</h2>
        {machine.alerts.length === 0 ? (
          <p className="text-sm text-white/50">No alerts have been raised for this point.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-xs text-white/60">
            {machine.alerts.map((alert) => (
              <li key={alert.id} className="flex justify-between">
                <span className="capitalize">{alert.type.replace("_", " ")}</span>
                <span>
                  {formatDateTime(alert.triggeredAt)}
                  {alert.resolvedAt ? ` → resolved ${formatDateTime(alert.resolvedAt)}` : " (active)"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}