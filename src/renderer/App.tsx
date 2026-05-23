import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, LockKeyhole } from "lucide-react";
import { useAccounts } from "./hooks/useAccounts";
import type { Account, ImportResult } from "./types";
import { AccountList } from "./components/AccountList";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { CurrentAccountCard } from "./components/CurrentAccountCard";
import { FirstRunDialog } from "./components/FirstRunDialog";
import { ImportButton } from "./components/ImportButton";
import { RenameDialog } from "./components/RenameDialog";

export default function App(): JSX.Element {
  const { accounts, current, loading, error, setError, refresh } = useAccounts();
  const [firstRunVisible, setFirstRunVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Account | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const showError = useCallback(
    (message: string | null) => {
      setNotice(null);
      setError(message);
    },
    [setError]
  );

  const showNotice = useCallback(
    (message: string) => {
      setError(null);
      setNotice(message);
    },
    [setError]
  );

  useEffect(() => {
    window.authSwitch
      .shouldShowFirstRun()
      .then(setFirstRunVisible)
      .catch((err) => showError(err instanceof Error ? err.message : String(err)));
  }, [showError]);

  async function handleSwitch(account: Account): Promise<void> {
    try {
      const result = await window.authSwitch.switchAccount(account.id);
      if (!result.success) {
        showError(result.error ?? "Switch failed.");
        return;
      }
      showNotice(result.alreadyCurrent ? `${account.name} is already current.` : `Switched to ${account.name}.`);
      await refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRename(name: string): Promise<void> {
    if (!renameTarget) return;
    try {
      await window.authSwitch.renameAccount(renameTarget.id, name);
      setRenameTarget(null);
      showNotice(`Renamed account to ${name}.`);
      await refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return;
    try {
      await window.authSwitch.deleteAccount(deleteTarget.id);
      showNotice(`Deleted ${deleteTarget.name}.`);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
      setDeleteTarget(null);
    }
  }

  function handleImported(result: ImportResult): void {
    const duplicateNote = result.duplicate ? " Duplicate content was ignored." : "";
    const sameEmailNote = result.sameEmailExists ? " Another account with this email already exists." : "";
    showNotice(`Imported ${result.account?.name ?? "auth.json"}.${duplicateNote}${sameEmailNote}`);
    void refresh();
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-console-bg text-console-text">
      {/* ── Fixed header ── */}
      <header className="flex shrink-0 items-center justify-between border-b border-console-line px-5 py-4">
        <div>
          <p className="mono-label text-[11px] text-console-green">local only</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">auth-switch</h1>
        </div>
        <div className="rounded-xl border border-console-line bg-console-panel p-2 text-console-green">
          <LockKeyhole size={20} />
        </div>
      </header>

      {/* ── Scrollable body — grows to fill remaining height ── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <CurrentAccountCard account={current} />

        {(error ?? notice) && (
          <div
            className={`mt-3 flex gap-2 rounded-xl border p-3 text-sm ${
              error
                ? "border-console-red/40 bg-console-red/10 text-console-red"
                : "border-console-green/40 bg-console-green/10 text-console-green"
            }`}
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p className="leading-5">{error ?? notice}</p>
          </div>
        )}

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="mono-label text-xs text-console-muted">Accounts</h2>
            <ImportButton onImported={handleImported} onError={showError} />
          </div>
          <AccountList
            accounts={accounts}
            loading={loading}
            onSwitch={(account) => void handleSwitch(account)}
            onRename={setRenameTarget}
            onDelete={setDeleteTarget}
          />
        </section>
      </div>

      {/* ── Fixed footer ── */}
      <footer className="shrink-0 border-t border-console-line px-5 py-3 text-xs leading-5 text-console-muted">
        <p>Data is stored locally only. auth.json contains sensitive tokens.</p>
        <p className="font-mono">DB: ~/.auth-switch/auth-switch.db</p>
      </footer>

      {firstRunVisible && (
        <FirstRunDialog
          onDone={() => {
            setFirstRunVisible(false);
            void refresh();
          }}
          onError={showError}
        />
      )}

      {renameTarget && (
        <RenameDialog
          account={renameTarget}
          onCancel={() => setRenameTarget(null)}
          onSave={(name) => void handleRename(name)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete account?"
          message={
            deleteTarget.is_current
              ? "Switch to another account before deleting this one."
              : `Delete "${deleteTarget.name}"? This will not touch ~/.codex/auth.json.`
          }
          confirmLabel={deleteTarget.is_current ? "OK" : "Delete"}
          destructive={!deleteTarget.is_current}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (deleteTarget.is_current) {
              setDeleteTarget(null);
            } else {
              void handleDelete();
            }
          }}
        />
      )}
    </main>
  );
}
