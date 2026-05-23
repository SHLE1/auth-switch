import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { AlertTriangle, LockKeyhole } from "lucide-react";
import { useTranslation } from "react-i18next";
import { setLanguage } from "./i18n/index";
import { useAccounts } from "./hooks/useAccounts";
import type { Account, CodexApiProfileInput, ImportResult } from "./types";
import { AccountList } from "./components/AccountList";
import { ApiProfileDialog } from "./components/ApiProfileDialog";
import { CurrentAccountCard } from "./components/CurrentAccountCard";
import { FirstRunDialog } from "./components/FirstRunDialog";
import { ImportButton } from "./components/ImportButton";
import { RenameDialog } from "./components/RenameDialog";

export default function App(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { accounts, current, loading, error, setError, refresh } = useAccounts();
  const [firstRunVisible, setFirstRunVisible] = useState(false);
  const [apiProfileVisible, setApiProfileVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Account | null>(null);
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
        showError(result.error ?? t("error.switchFailed"));
        return;
      }
      showNotice(
        result.alreadyCurrent
          ? t("notice.alreadyCurrent", { name: account.name })
          : t("notice.switchedTo", { name: account.name })
      );
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
      showNotice(t("notice.renamed", { name }));
      await refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(account: Account): Promise<void> {
    try {
      await window.authSwitch.deleteAccount(account.id);
      showNotice(t("notice.deleted", { name: account.name }));
      await refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  }

  async function requestDelete(account: Account): Promise<void> {
    if (account.is_current) {
      try {
        await window.authSwitch.nativeMessage(t("deleteDialog.title"), t("deleteDialog.isCurrent"), t("common.ok"));
      } catch (err) {
        showError(err instanceof Error ? err.message : String(err));
      }
      return;
    }

    try {
      const confirmed = await window.authSwitch.nativeConfirm(
        t("deleteDialog.title"),
        t("deleteDialog.confirm", { name: account.name }),
        t("common.delete"),
        t("common.cancel")
      );
      if (confirmed) await handleDelete(account);
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleCreateApiProfile(input: CodexApiProfileInput): Promise<void> {
    try {
      const result = await window.authSwitch.createApiProfile(input);
      if (!result.success) {
        showError(result.error ?? t("error.saveApiProfileFailed"));
        return;
      }
      setApiProfileVisible(false);
      showNotice(t("notice.savedApiProfile", { name: result.account?.name ?? input.name }));
      await refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleImported(result: ImportResult): void {
    const duplicateNote = result.duplicate ? t("notice.duplicateIgnored") : "";
    const sameEmailNote = result.sameEmailExists ? t("notice.sameEmailExists") : "";
    showNotice(t("notice.imported", { name: result.account?.name ?? "auth.json" }) + duplicateNote + sameEmailNote);
    void refresh();
  }

  const currentLang = i18n.language.startsWith("zh") ? "zh" : "en";
  const dragRegionStyle = { WebkitAppRegion: "drag" } as CSSProperties;
  const noDragRegionStyle = { WebkitAppRegion: "no-drag" } as CSSProperties;
  const isMac = /Macintosh/.test(navigator.userAgent);

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-transparent text-console-text">
      {/* macOS traffic-light spacer — gives the inset traffic lights unobstructed space */}
      {isMac && (
        <div style={dragRegionStyle} className="h-8 w-full shrink-0" />
      )}
      {/* ── Fixed header ── */}
      <header
        style={dragRegionStyle}
        className="flex shrink-0 items-center justify-between border-b border-console-line bg-[rgba(8,11,15,0.85)] px-5 py-4"
      >
        <div>
          <p className="mono-label text-[11px] text-console-green">{t("app.localOnly")}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">auth-switch</h1>
        </div>
        <div style={noDragRegionStyle} className="flex items-center gap-3">
          {/* Language toggle */}
          <div className="flex rounded-lg border border-console-line overflow-hidden font-mono text-xs">
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`px-2.5 py-1.5 transition ${
                currentLang === "en"
                  ? "bg-console-green/20 text-console-green"
                  : "text-console-muted hover:text-console-text"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage("zh")}
              className={`px-2.5 py-1.5 border-l border-console-line transition ${
                currentLang === "zh"
                  ? "bg-console-green/20 text-console-green"
                  : "text-console-muted hover:text-console-text"
              }`}
            >
              中文
            </button>
          </div>
          <div className="rounded-xl border border-console-line bg-console-panel p-2 text-console-green">
            <LockKeyhole size={20} />
          </div>
        </div>
      </header>

      {/* ── Scrollable body — grows to fill remaining height ── */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[rgba(8,11,15,0.82)] px-5 py-4">
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
            <h2 className="mono-label text-xs text-console-muted">{t("app.accounts")}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setApiProfileVisible(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-console-line bg-console-panel px-3 py-2 font-mono text-sm text-console-text transition hover:border-console-green/60 hover:text-console-green"
              >
                {t("app.addApi")}
              </button>
              <ImportButton onImported={handleImported} onError={showError} />
            </div>
          </div>
          <AccountList
            accounts={accounts}
            loading={loading}
            onSwitch={(account) => void handleSwitch(account)}
            onRename={setRenameTarget}
            onDelete={(account) => void requestDelete(account)}
          />
        </section>
      </div>

      {/* ── Fixed footer ── */}
      <footer className="shrink-0 border-t border-console-line bg-[rgba(8,11,15,0.85)] px-5 py-3 text-xs leading-5 text-console-muted">
        <p>{t("app.footer.local")}</p>
        <p className="font-mono">{t("app.footer.db")}</p>
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

      {apiProfileVisible && (
        <ApiProfileDialog onCancel={() => setApiProfileVisible(false)} onSave={(input) => void handleCreateApiProfile(input)} />
      )}

      {renameTarget && (
        <RenameDialog
          account={renameTarget}
          onCancel={() => setRenameTarget(null)}
          onSave={(name) => void handleRename(name)}
        />
      )}

    </main>
  );
}
