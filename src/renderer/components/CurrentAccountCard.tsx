import { ShieldCheck, Terminal } from "lucide-react";
import type { Account } from "../types";

interface CurrentAccountCardProps {
  account: Account | null;
}

export function CurrentAccountCard({ account }: CurrentAccountCardProps): JSX.Element {
  return (
    <section className="rounded-xl border border-console-line bg-[#0d1219]/90 p-4">
      <div className="mb-3 flex items-center gap-2 text-console-green">
        <ShieldCheck size={16} />
        <span className="mono-label text-[11px]">Current Codex Account</span>
      </div>

      {account ? (
        <div>
          <h2 className="truncate text-lg font-semibold text-console-text">{account.name}</h2>
          <p className="mt-1 truncate font-mono text-sm text-console-muted">{account.email ?? "email unavailable"}</p>
          <p className="mt-3 flex items-center gap-2 font-mono text-xs text-console-green">
            <Terminal size={14} /> Active · ~/.codex/auth.json
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-console-text">No current account</h2>
          <p className="mt-1 text-sm leading-5 text-console-muted">
            Import an auth.json, then switch to it to make it active for Codex.
          </p>
        </div>
      )}
    </section>
  );
}
