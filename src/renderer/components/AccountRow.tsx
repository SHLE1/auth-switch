import { Check, MoreHorizontal, Trash2 } from "lucide-react";
import type { Account } from "../types";

interface AccountRowProps {
  account: Account;
  onSwitch: (account: Account) => void;
  onRename: (account: Account) => void;
  onDelete: (account: Account) => void;
}

export function AccountRow({ account, onSwitch, onRename, onDelete }: AccountRowProps): JSX.Element {
  return (
    <li className="rounded-xl border border-console-line bg-[#0b1017] p-3">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full border border-console-line text-console-green">
          {account.is_current ? <Check size={14} /> : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-console-text">{account.name}</h3>
              <p className="truncate font-mono text-xs text-console-muted">{account.email ?? "email unavailable"}</p>
            </div>
            {account.is_current ? (
              <span className="rounded-full border border-console-green/40 px-2 py-1 font-mono text-[11px] text-console-green">
                current
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onSwitch(account)}
                className="rounded-md border border-console-line px-3 py-1.5 font-mono text-xs text-console-text transition hover:border-console-green/60 hover:text-console-green"
              >
                Switch
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onRename(account)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs text-console-muted transition hover:bg-white/5 hover:text-console-text"
            >
              <MoreHorizontal size={14} /> Rename
            </button>
            <button
              type="button"
              onClick={() => onDelete(account)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs text-console-muted transition hover:bg-console-red/10 hover:text-console-red"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
