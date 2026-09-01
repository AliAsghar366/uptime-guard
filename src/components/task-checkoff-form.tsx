"use client";

import { useActionState, useRef } from "react";
import { CheckCircle2, AlertTriangle, Camera } from "lucide-react";
import { recordTaskStatus, type ActionState } from "@/app/actions/tasks";

const initialState: ActionState = { error: null };

export function TaskCheckoffForm({ taskId }: { taskId: string }) {
  const [state, formAction, isPending] = useActionState(recordTaskStatus, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="taskId" value={taskId} />

      <div className="flex gap-2">
        <button
          type="submit"
          name="status"
          value="working"
          disabled={isPending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-status-working)]/40 bg-[var(--color-status-working)]/10 px-3 py-2 text-sm font-semibold text-[var(--color-status-working)] transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          <CheckCircle2 size={16} />
          Mark OK
        </button>
        <button
          type="submit"
          name="status"
          value="not_working"
          disabled={isPending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-status-not-working)]/40 bg-[var(--color-status-not-working)]/10 px-3 py-2 text-sm font-semibold text-[var(--color-status-not-working)] transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          <AlertTriangle size={16} />
          Not Working
        </button>
      </div>

      <details className="text-xs text-white/60">
        <summary className="flex cursor-pointer select-none items-center gap-1">
          <Camera size={13} /> optional comment / photo
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            name="comment"
            rows={2}
            placeholder="Add a note (optional)"
            className="glass-input w-full px-2.5 py-1.5 text-xs text-white placeholder:text-white/40"
          />
          <input
            type="file"
            name="photo"
            accept="image/*"
            capture="environment"
            className="text-xs text-white/65 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-white/80"
          />
        </div>
      </details>

      {state.error ? (
        <p className="flex items-center gap-1 text-xs text-[var(--color-status-overdue)]">
          <AlertTriangle size={12} /> {state.error}
        </p>
      ) : null}
      {!state.error && state.success ? (
        <p className="flex items-center gap-1 text-xs text-[var(--color-status-working)]">
          <CheckCircle2 size={12} /> Saved.
        </p>
      ) : null}
    </form>
  );
}