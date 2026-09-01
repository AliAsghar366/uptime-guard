"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";
import { LogoMark } from "@/components/logo-mark";

const initialState: LoginState = { error: null };

// Testing-only convenience: one-click logins for the demo accounts, so a role's dashboard can be
// pulled up without retyping credentials. Gated on NODE_ENV so a production build (`next build`
// && `next start`) never renders it, even if this ends up deployed somewhere later.
const DEMO_ACCOUNTS: { label: string; username: string; password: string }[] = [
  { label: "Super Admin (Khalid)", username: "khalid.admin", password: "auLh92c0Hg9LfZfE" },
  { label: "Production Engineer (Adeel)", username: "adeel.pe", password: "yEoqYqaqzgN" },
  { label: "Admin / Lead Operator (Majid, BF)", username: "majid.bf", password: "WMEdz9Yk09PO" },
  { label: "Operator (Sharjeel, BF)", username: "sharjeel.bf", password: "2pbAOFgza05C" },
];

const quickLogin = login.bind(null, initialState);

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="glass-panel-strong w-full max-w-sm p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoMark />
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Uptime Guard
          </h1>
          <p className="text-sm text-white/60">
            Preventive maintenance &amp; lubrication tracking
          </p>
        </div>

        <form action={formAction} className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-xs font-medium text-white/70">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="glass-input w-full px-3.5 py-2.5 text-sm text-white placeholder:text-white/35"
              placeholder="e.g. sharjeel.bf"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium text-white/70">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="glass-input w-full px-3.5 py-2.5 text-sm text-white placeholder:text-white/35"
              placeholder="••••••••"
            />
          </div>

          {state.error ? (
            <p className="rounded-lg border border-[var(--color-status-overdue)]/40 bg-[var(--color-status-overdue)]/10 px-3 py-2 text-xs text-[var(--color-status-overdue)]">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="mt-2 rounded-xl bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-brand-teal)] px-4 py-2.5 text-sm font-semibold text-navy-950 shadow-lg shadow-[#3b9ef5]/20 transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-white/40">
          <span className="status-pill status-pill--working">● system healthy</span>
        </div>

        {process.env.NODE_ENV !== "production" ? (
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-wide text-white/40">
              Testing only -- quick login
            </p>
            <div className="flex flex-col gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <form key={account.username} action={quickLogin}>
                  <input type="hidden" name="username" value={account.username} />
                  <input type="hidden" name="password" value={account.password} />
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white/70 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                  >
                    {account.label}
                  </button>
                </form>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}