import { useEffect, useState } from "react";
import type { LiveAuthStatus } from "../types";

interface FirstRunDialogProps {
  onDone: () => void;
  onError: (message: string) => void;
}

export function FirstRunDialog({ onDone, onError }: FirstRunDialogProps): JSX.Element {
  const [status, setStatus] = useState<LiveAuthStatus | null>(null);
  const [name, setName] = useState("Unnamed account");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.authSwitch
      .getLiveAuthStatus()
      .then((nextStatus) => {
        setStatus(nextStatus);
        setName(nextStatus.email ?? "Unnamed account");
      })
      .catch((error) => onError(error instanceof Error ? error.message : String(error)));
  }, [onError]);

  async function dismiss(): Promise<void> {
    try {
      await window.authSwitch.dismissFirstRun();
      onDone();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleImport(): Promise<void> {
    setBusy(true);
    try {
      const result = await window.authSwitch.importLiveAuthFile(name, true);
      if (!result.success) {
        onError(result.error ?? "Import failed.");
        return;
      }
      await dismiss();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5">
      <section className="w-full max-w-md rounded-2xl border border-console-line bg-console-panel p-6 shadow-2xl">
        <p className="mono-label text-[11px] text-console-green">First run</p>
        <h2 className="mt-3 text-xl font-semibold text-console-text">Welcome to auth-switch</h2>

        {!status ? (
          <p className="mt-4 font-mono text-sm text-console-muted">Checking ~/.codex/auth.json...</p>
        ) : status.exists ? (
          <>
            <p className="mt-4 text-sm leading-6 text-console-muted">
              An existing Codex auth file was detected at <span className="font-mono text-console-text">~/.codex/auth.json</span>
              {status.email ? (
                <>
                  {" "}for <span className="font-mono text-console-green">{status.email}</span>
                </>
              ) : null}
              . Import it as your first account?
            </p>
            <label className="mt-4 block">
              <span className="mono-label text-[11px] text-console-muted">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-console-line bg-[#080b0f] px-3 py-2 text-sm text-console-text outline-none ring-console-green/30 focus:border-console-green/70 focus:ring-2"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void dismiss()}
                className="rounded-lg border border-console-line px-3 py-2 font-mono text-sm text-console-muted hover:text-console-text"
              >
                Skip
              </button>
              <button
                type="button"
                disabled={busy || !name.trim()}
                onClick={() => void handleImport()}
                className="rounded-lg border border-console-green/60 bg-console-green/10 px-3 py-2 font-mono text-sm text-console-green hover:bg-console-green/20"
              >
                Import
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm leading-6 text-console-muted">
              No Codex auth file found yet. Log in to Codex first, then import your auth.json here.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => void dismiss()}
                className="rounded-lg border border-console-green/60 bg-console-green/10 px-3 py-2 font-mono text-sm text-console-green hover:bg-console-green/20"
              >
                OK
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
