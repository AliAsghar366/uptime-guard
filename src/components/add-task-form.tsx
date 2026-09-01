"use client";

import { useActionState, useEffect, useRef } from "react";
import { AlertTriangle, Siren } from "lucide-react";
import { createTask, type TaskFormState } from "@/app/actions/machines";
import { ReferencePhotoPicker } from "@/components/reference-photo-picker";

const initialState: TaskFormState = { error: null, warning: null };

export function AddTaskForm({
  sectionId,
  lubricants,
}: {
  sectionId: string;
  lubricants: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createTask, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmDuplicateRef = useRef<HTMLInputElement>(null);
  const confirmFrequencyRef = useRef<HTMLInputElement>(null);

  function handleConfirmAnyway() {
    if (state.warningType === "duplicate" && confirmDuplicateRef.current) {
      confirmDuplicateRef.current.value = "true";
    }
    if (state.warningType === "frequency" && confirmFrequencyRef.current) {
      confirmFrequencyRef.current.value = "true";
    }
  }

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      if (confirmDuplicateRef.current) confirmDuplicateRef.current.value = "";
      if (confirmFrequencyRef.current) confirmFrequencyRef.current.value = "";
    }
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-2 border-t border-white/10 pt-3"
    >
      <input type="hidden" name="sectionId" value={sectionId} />
      <input ref={confirmDuplicateRef} type="hidden" name="confirmDuplicate" defaultValue="" />
      <input ref={confirmFrequencyRef} type="hidden" name="confirmFrequency" defaultValue="" />

      <div className="flex flex-wrap items-end gap-2">
        <input
          name="description"
          placeholder="Task description"
          required
          className="glass-input min-w-[220px] flex-1 px-2.5 py-1.5 text-xs text-white"
        />
        <input
          name="noOfPoints"
          type="number"
          defaultValue={2}
          min={1}
          className="glass-input w-20 px-2.5 py-1.5 text-xs text-white"
          placeholder="Points"
        />
        <input
          name="lubricationPoints"
          type="number"
          defaultValue={2}
          min={1}
          className="glass-input w-24 px-2.5 py-1.5 text-xs text-white"
          placeholder="Lube pts"
        />
        <select name="frequencyLabel" className="glass-input px-2.5 py-1.5 text-xs text-white">
          <option>Weekly</option>
          <option>2 Weeks</option>
          <option>Monthly</option>
        </select>
        <select name="lubricantId" className="glass-input px-2.5 py-1.5 text-xs text-white">
          <option value="">No lubricant</option>
          {lubricants.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[11px] text-white/70">
          <input type="checkbox" name="isCritical" value="true" />
          <Siren size={12} /> Critical
        </label>
        <ReferencePhotoPicker />
        <button
          disabled={isPending}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/8 disabled:opacity-50"
        >
          Add Task
        </button>
      </div>

      {state.warning ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-status-due-soon)]/40 bg-[var(--color-status-due-soon)]/10 px-3 py-2 text-xs text-[var(--color-status-due-soon)]">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1">{state.warning}</span>
          <button
            type="submit"
            onClick={handleConfirmAnyway}
            className="rounded-md border border-[var(--color-status-due-soon)]/50 px-2.5 py-1 font-semibold hover:bg-[var(--color-status-due-soon)]/20"
          >
            Yes, add anyway
          </button>
        </div>
      ) : null}
      {state.error ? (
        <p className="text-[11px] text-[var(--color-status-overdue)]">{state.error}</p>
      ) : null}
    </form>
  );
}