import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LiveAuthStatus } from "../types";

interface FirstRunDialogProps {
  onDone: () => void;
  onError: (message: string) => void;
}

export function FirstRunDialog({ onDone, onError }: FirstRunDialogProps): JSX.Element {
  const { t } = useTranslation();
  const [status, setStatus] = useState<LiveAuthStatus | null>(null);
  const [name, setName] = useState(t("firstRun.unnamedAccount"));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.authSwitch
      .getLiveAuthStatus()
      .then((nextStatus) => {
        setStatus(nextStatus);
        setName(nextStatus.email ?? t("firstRun.unnamedAccount"));
      })
      .catch((error) => onError(error instanceof Error ? error.message : String(error)));
  }, [onError, t]);

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
        onError(result.error ?? t("error.importFailed"));
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
        <p className="mono-label text-[11px] text-console-green">{t("firstRun.label")}</p>
        <h2 className="mt-3 text-xl font-semibold text-console-text">{t("firstRun.title")}</h2>

        {!status ? (
          <p className="mt-4 font-mono text-sm text-console-muted">{t("firstRun.checking")}</p>
        ) : status.exists ? (
          <>
            <p className="mt-4 text-sm leading-6 text-console-muted">
              {t("firstRun.detectedPrefix")}{" "}
              <span className="font-mono text-console-text">~/.codex/auth.json</span>
              {status.email ? (
                <>
                  {" "}{t("firstRun.detectedFor")}{" "}
                  <span className="font-mono text-console-green">{status.email}</span>
                </>
              ) : null}
              {t("firstRun.detectedSuffix")}
            </p>
            <label className="mt-4 block">
              <span className="mono-label text-[11px] text-console-muted">{t("common.name")}</span>
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
                {t("common.skip")}
              </button>
              <button
                type="button"
                disabled={busy || !name.trim()}
                onClick={() => void handleImport()}
                className="rounded-lg border border-console-green/60 bg-console-green/10 px-3 py-2 font-mono text-sm text-console-green hover:bg-console-green/20"
              >
                {t("common.import")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm leading-6 text-console-muted">{t("firstRun.noFile")}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => void dismiss()}
                className="rounded-lg border border-console-green/60 bg-console-green/10 px-3 py-2 font-mono text-sm text-console-green hover:bg-console-green/20"
              >
                {t("common.ok")}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
