"use client";

import { useActionState, useRef } from "react";
import { createAccount, type ActionState } from "@/app/actions/accounts";
import type { UserRole } from "@/lib/db/schema";

const initialState: ActionState = { error: null };

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "operator", label: "Operator" },
  { value: "admin", label: "Admin / Lead Operator" },
  { value: "production_engineer", label: "Production Engineer" },
  { value: "super_admin", label: "Super Admin" },
];

export function CreateAccountForm({
  units,
  canAssignAllRoles,
}: {
  units: { id: string; code: string; name: string }[];
  canAssignAllRoles: boolean;
}) {
  const [state, formAction, isPending] = useActionState(createAccount, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const roleOptions = canAssignAllRoles ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r.value === "operator");

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="glass-panel flex flex-col gap-3 p-5"
    >
      <h2 className="text-sm font-semibold text-white">Create Account</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="username" placeholder="username" required className="glass-input px-3 py-1.5 text-sm text-white" />
        <input name="fullName" placeholder="Full name" required className="glass-input px-3 py-1.5 text-sm text-white" />
        <input
          name="password"
          type="password"
          placeholder="Temporary password (min 8 chars)"
          minLength={8}
          required
          className="glass-input px-3 py-1.5 text-sm text-white"
        />
        <select name="role" required className="glass-input px-3 py-1.5 text-sm text-white">
          {roleOptions.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-white/60">Assign to unit(s)</span>
        <div className="flex flex-wrap gap-3">
          {units.map((u) => (
            <label key={u.id} className="flex items-center gap-1.5 text-xs text-white/70">
              <input type="checkbox" name="unitIds" value={u.id} />
              {u.code}
            </label>
          ))}
        </div>
      </div>

      {state.error ? <p className="text-xs text-[var(--color-status-overdue)]">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-[var(--color-status-working)]">Account created.</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-fit rounded-lg bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-brand-teal)] px-4 py-1.5 text-sm font-semibold text-navy-950 disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create Account"}
      </button>
    </form>
  );
}