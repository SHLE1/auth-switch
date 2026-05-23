import { useEffect, useState } from "react";
import type { Account } from "../types";

interface RenameDialogProps {
  account: Account;
  onCancel: () => void;
  onSave: (name: string) => void;
}

export function RenameDialog({ account, onCancel, onSave }: RenameDialogProps): JSX.Element {
  const [name, setName] = useState(account.name);

  useEffect(() => {
    setName(account.name);
  }, [account]);

  const canSave = name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">
      <form
        className="w-full max-w-sm rounded-2xl border border-console-line bg-console-panel p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) onSave(name.trim());
        }}
      >
        <h2 className="text-lg font-semibold text-console-text">Rename account</h2>
        <p className="mt-2 truncate font-mono text-xs text-console-muted">{account.email ?? account.id}</p>
        <label className="mt-4 block">
          <span className="mono-label text-[11px] text-console-muted">Name</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-lg border border-console-line bg-[#080b0f] px-3 py-2 text-sm text-console-text outline-none ring-console-green/30 focus:border-console-green/70 focus:ring-2"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-console-line px-3 py-2 font-mono text-sm text-console-muted hover:text-console-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-lg border border-console-green/60 bg-console-green/10 px-3 py-2 font-mono text-sm text-console-green hover:bg-console-green/20"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
