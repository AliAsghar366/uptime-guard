import Link from "next/link";
import { ROLE_INFO, type PreviewRole } from "./mock-data";

export default function PreviewIndexPage() {
  const roles = Object.keys(ROLE_INFO) as PreviewRole[];

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="glass-panel-strong w-full max-w-md p-8">
        <h1 className="text-center text-xl font-semibold text-white">Uptime Guard — Preview</h1>
        <p className="mt-2 text-center text-xs text-white/50">
          Fake data, not connected to the database. Pick a role to see its view.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          {roles.map((role) => (
            <Link
              key={role}
              href={`/preview/${role}/tasks`}
              className="glass-input flex items-center justify-between px-4 py-3 text-sm text-white transition-colors hover:bg-white/8"
            >
              <span>{ROLE_INFO[role].label}</span>
              <span className="text-white/40">{ROLE_INFO[role].personName} →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}