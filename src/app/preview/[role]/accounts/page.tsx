import { notFound } from "next/navigation";
import { isPreviewRole, canManageAccounts, mockAccounts } from "../../mock-data";

export default async function PreviewAccountsPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isPreviewRole(role)) notFound();

  if (!canManageAccounts(role)) {
    return (
      <div className="glass-panel p-6 text-sm text-white/60">
        This role doesn&apos;t have access to Accounts — in the real app it would redirect
        straight back to Tasks.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-white">Accounts</h1>
      <div className="glass-panel flex flex-col gap-3 p-5">
        {mockAccounts.map((account) => (
          <div key={account.id} className="glass-input flex flex-wrap items-center justify-between gap-2 p-3">
            <div>
              <span className="text-sm font-medium text-white">{account.name}</span>{" "}
              <span className="text-xs text-white/40">@{account.username}</span>{" "}
              <span className="status-pill status-pill--neutral ml-2">{account.role}</span>
            </div>
            <div className="flex gap-2">
              {account.units.map((u) => (
                <span key={u} className="status-pill status-pill--working">
                  {u}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}