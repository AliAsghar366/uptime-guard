"use client";

import { useActionState } from "react";
import { Copy } from "lucide-react";
import { cloneUnit, type CloneUnitState } from "@/app/actions/machines";

const initialState: CloneUnitState = { error: null };

export function CloneUnitForm({ units }: { units: { id: string; code: string; name: string }[] }) {
  const [state, formAction, isPending] = useActionState(cloneUnit, initialState);

  if (units.length === 0) return null;

  return (
    <form action={formAction} className="glass-panel flex flex-wrap items-end gap-3 p-4">
      <div className="flex items-center gap-1.5 text-xs text-white/60">
        <Copy size={14} /> Clone from
      </div>
      <select name="sourceUnitId" required className="glass-input px-3 py-1.5 text-sm text-white">
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.code})
          </option>
        ))}
      </select>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-white/60">New unit code</label>
        <input name="code" placeholder="e.g. EF" required className="glass-input px-3 py-1.5 text-sm text-white" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-white/60">Unit name</label>
        <input name="name" placeholder="e.g. E Flute" required className="glass-input px-3 py-1.5 text-sm text-white" />
      </div>
      <button
        disabled={isPending}
        className="rounded-lg border border-white/15 px-4 py-1.5 text-sm text-white/80 hover:bg-white/8 disabled:opacity-50"
      >
        {isPending ? "Cloning…" : "Clone unit (sections + tasks)"}
      </button>
      {state.error ? <p className="w-full text-xs text-[var(--color-status-overdue)]">{state.error}</p> : null}
      {state.success ? <p className="w-full text-xs text-[var(--color-status-working)]">Unit cloned.</p> : null}
    </form>
  );
}