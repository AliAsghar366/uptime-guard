"use client";

import { useActionState, useRef } from "react";
import { addEventAnnotation, type ActionState } from "@/app/actions/tasks";

const initialState: ActionState = { error: null };

export function EventAnnotationForm({ eventId }: { eventId: string }) {
  const [state, formAction, isPending] = useActionState(addEventAnnotation, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        formAction(formData);
        formRef.current?.reset();
      }}
      className="mt-2 flex gap-2"
    >
      <input type="hidden" name="eventId" value={eventId} />
      <input
        type="text"
        name="body"
        placeholder="Add a comment on this entry…"
        required
        className="glass-input flex-1 px-2.5 py-1.5 text-xs text-white placeholder:text-white/35"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/8 disabled:opacity-50"
      >
        Comment
      </button>
      {state.error ? <p className="text-[11px] text-[var(--color-status-overdue)]">{state.error}</p> : null}
    </form>
  );
}