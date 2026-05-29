import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AlertTriangle, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getErrorMessage } from "../shared/errors";
import { authSwitch } from "./api/authSwitch";
import { setLanguage } from "./i18n/index";
import { useAccounts } from "./hooks/useAccounts";
import { useTheme } from "./hooks/useTheme";
import type { Account, AccountUsageQuota, ClaudeProfileInput, CodexApiProfileInput, ImportResult } from "../shared/types";
import { AccountList } from "./components/AccountList";
import { ApiProfileDialog } from "./components/ApiProfileDialog";
import { ClaudeProfileDialog } from "./components/ClaudeProfileDialog";
import { CurrentAccountCard } from "./components/CurrentAccountCard";
import { FirstRunDialog } from "./components/FirstRunDialog";
import { ImportButton } from "./components/ImportButton";
import { PasteAuthJsonDialog } from "./components/PasteAuthJsonDialog";
import { RenameDialog } from "./components/RenameDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EMPTY_USAGE_QUOTA_STATE, UsageQuotaContext, type UsageQuotaState } from "./contexts/UsageQuotaContext";
function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export default function App(): JSX.Element {
  const { t, i18n } = useTranslation();
  const {
    accounts,
    codexAccounts,
    claudeAccounts,
    codexCurrent,
    claudeCurrent,
    loading,
    error,
    setError,
    refresh
  } = useAccounts();
  const { theme, toggle: toggleTheme } = useTheme();
  const [firstRunVisible, setFirstRunVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<"codex" | "claude">("codex");
  const [apiProfileVisible, setApiProfileVisible] = useState(false);
  const [claudeProfileVisible, setClaudeProfileVisible] = useState(false);
  const [editApiProfile, setEditApiProfile] = useState<Account | null>(null);
  const [editClaudeProfile, setEditClaudeProfile] = useState<Account | null>(null);
  const [pasteAuthJsonVisible, setPasteAuthJsonVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Account | null>(null);
  const [notices, setNotices] = useState<{ codex: string | null; claude: string | null }>({ codex: null, claude: null });
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });
  const [usageQuotaByAccountId, setUsageQuotaByAccountId] = useState<Record<string, UsageQuotaState>>({});
  const usageRefreshStartedRef = useRef(false);
  const refreshUsageAccount = useCallback(async (accountId: string) => {
    setUsageQuotaByAccountId((prev) => ({
      ...prev,
      [accountId]: { ...(prev[accountId] ?? EMPTY_USAGE_QUOTA_STATE), loading: true, error: null }
    }));
    try {
      const mockQuota = !isTauriRuntime()
        ? (window as Window & { __AUTH_SWITCH_MOCK_USAGE__?: Record<string, AccountUsageQuota> }).__AUTH_SWITCH_MOCK_USAGE__?.[accountId]
        : null;
      const quota = mockQuota ?? await authSwitch.getAccountUsageQuota(accountId);
      setUsageQuotaByAccountId((prev) => ({
        ...prev,
        [accountId]: { quota, loading: false, error: null }
      }));
    } catch (error) {
      setUsageQuotaByAccountId((prev) => ({
        ...prev,
        [accountId]: { quota: prev[accountId]?.quota ?? null, loading: false, error: getErrorMessage(error) }
      }));
    }
  }, []);

  useEffect(() => {
    if (loading || usageRefreshStartedRef.current) return;
    usageRefreshStartedRef.current = true;
    for (const account of accounts) {
      if (account.app === "codex" || account.app === "claude") {
        void refreshUsageAccount(account.id);
      }
    }
  }, [accounts, loading, refreshUsageAccount]);

  const usageQuotaContextValue = useMemo(
    () => ({
      getState: (accountId: string) => usageQuotaByAccountId[accountId] ?? EMPTY_USAGE_QUOTA_STATE,
      refreshAccount: refreshUsageAccount
    }),
    [refreshUsageAccount, usageQuotaByAccountId]
  );
  useEffect(() => {
    const idx = activeTab === "codex" ? 0 : 1;
    const el = tabRefs.current[idx];
    if (el) {
      const parent = el.parentElement;
      if (parent) {
        setPillStyle({ left: el.offsetLeft, width: el.offsetWidth });
      }
    }
  }, [activeTab]);

  const showError = useCallback(
    (message: string | null) => {
      setNotices({ codex: null, claude: null });
      setError(message);
    },
    [setError]
  );

  const showNotice = useCallback(
    (message: string, app: "codex" | "claude") => {
      setError(null);
      setNotices((prev) => ({ ...prev, [app]: message }));
    },
    [setError]
  );

  useEffect(() => {
    if (!isTauriRuntime()) return;
    authSwitch
      .shouldShowFirstRun()
      .then(setFirstRunVisible)
      .catch((error) => showError(getErrorMessage(error)));
  }, [showError]);

  async function handleSwitch(account: Account): Promise<void> {
    setSwitchingId(account.id);
    try {
      const result = await authSwitch.switchAccount(account.id);
      if (!result.success) {
        showError(result.error ?? t("error.switchFailed"));
        return;
      }
      showNotice(
        result.alreadyCurrent
          ? t("notice.alreadyCurrent", { name: account.name })
          : t("notice.switchedTo", { name: account.name }),
        account.app
      );
      await refresh();
      if (account.app === "codex" || account.app === "claude") await refreshUsageAccount(account.id);
    } catch (error) {
      showError(getErrorMessage(error));
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleRename(name: string): Promise<void> {
    if (!renameTarget) return;
    const renamedAccount = renameTarget;
    try {
      await authSwitch.renameAccount(renamedAccount.id, name);
      setRenameTarget(null);
      showNotice(t("notice.renamed", { name }), renamedAccount.app);
      await refresh();
    } catch (error) {
      showError(getErrorMessage(error));
    }
  }

  async function handleDelete(account: Account): Promise<void> {
    try {
      await authSwitch.deleteAccount(account.id);
      showNotice(t("notice.deleted", { name: account.name }), account.app);
      await refresh();
      if (account.app === "codex" || account.app === "claude") {
        setUsageQuotaByAccountId((prev) => {
          const next = { ...prev };
          delete next[account.id];
          return next;
        });
      }
    } catch (error) {
      showError(getErrorMessage(error));
    }
  }

  async function requestDelete(account: Account): Promise<void> {
    if (account.is_current) {
      try {
        await authSwitch.nativeMessage(
          t("deleteDialog.title"),
          t("deleteDialog.isCurrent"),
          t("common.ok")
        );
      } catch (error) {
        showError(getErrorMessage(error));
      }
      return;
    }
    try {
      const confirmed = await authSwitch.nativeConfirm(
        t("deleteDialog.title"),
        t(account.app === "claude" ? "deleteDialog.confirmClaude" : "deleteDialog.confirm", { name: account.name }),
        t("common.delete"),
        t("common.cancel")
      );
      if (confirmed) await handleDelete(account);
    } catch (error) {
      showError(getErrorMessage(error));
    }
  }

  async function handleCreateApiProfile(input: CodexApiProfileInput): Promise<void> {
    try {
      const result = await authSwitch.createApiProfile(input);
      if (!result.success) {
        showError(result.error ?? t("error.saveApiProfileFailed"));
        return;
      }
      setApiProfileVisible(false);
      showNotice(t("notice.savedApiProfile", { name: result.account?.name ?? input.name }), "codex");
      await refresh();
      if (result.account) await refreshUsageAccount(result.account.id);
    } catch (error) {
      showError(getErrorMessage(error));
    }
  }

  async function handleCreateClaudeProfile(input: ClaudeProfileInput): Promise<void> {
    try {
      const result = await authSwitch.createClaudeProfile(input);
      if (!result.success) {
        showError(result.error ?? t("error.saveClaudeProfileFailed"));
        return;
      }
      setClaudeProfileVisible(false);
      showNotice(t("notice.savedClaudeProfile", { name: result.account?.name ?? input.name }), "claude");
      await refresh();
      if (result.account) await refreshUsageAccount(result.account.id);
    } catch (error) {
      showError(getErrorMessage(error));
    }
  }

  async function handleUpdateApiProfile(input: CodexApiProfileInput): Promise<void> {
    if (!editApiProfile) return;
    try {
      const result = await authSwitch.updateApiProfile(editApiProfile.id, input);
      if (!result.success) {
        showError(result.error ?? t("error.updateApiProfileFailed"));
        return;
      }
      setEditApiProfile(null);
      showNotice(t("notice.updatedApiProfile", { name: result.account?.name ?? input.name }), "codex");
      await refresh();
      if (result.account) await refreshUsageAccount(result.account.id);
    } catch (error) {
      showError(getErrorMessage(error));
    }
  }

  async function handleUpdateClaudeProfile(input: ClaudeProfileInput): Promise<void> {
    if (!editClaudeProfile) return;
    try {
      const result = await authSwitch.updateClaudeProfile(editClaudeProfile.id, input);
      if (!result.success) {
        showError(result.error ?? t("error.updateClaudeProfileFailed"));
        return;
      }
      setEditClaudeProfile(null);
      showNotice(t("notice.updatedClaudeProfile", { name: result.account?.name ?? input.name }), "claude");
      await refresh();
      if (result.account) await refreshUsageAccount(result.account.id);
    } catch (error) {
      showError(getErrorMessage(error));
    }
  }

  function handleEditAccount(account: Account): void {
    if (account.app === "claude") {
      setEditClaudeProfile(account);
    } else {
      setEditApiProfile(account);
    }
  }
  function handleImported(result: ImportResult): void {
    const duplicateNote = result.duplicate ? t("notice.duplicateIgnored") : "";
    const sameEmailNote = result.sameEmailExists ? t("notice.sameEmailExists") : "";
    showNotice(
      t("notice.imported", { name: result.account?.name ?? "auth.json" }) +
        duplicateNote +
        sameEmailNote,
      "codex"
    );
    void refresh().then(() => {
      if (result.account && (result.account.app === "codex" || result.account.app === "claude")) void refreshUsageAccount(result.account.id);
    });
  }

  const currentLang = i18n.language.startsWith("zh") ? "zh" : "en";
  const dragRegionStyle = { WebkitAppRegion: "drag" } as CSSProperties;
  const noDragRegionStyle = { WebkitAppRegion: "no-drag" } as CSSProperties;
  const activeAccounts = activeTab === "claude" ? claudeAccounts : codexAccounts;
  const activeCurrent = activeTab === "claude" ? claudeCurrent : codexCurrent;

  return (
    <UsageQuotaContext.Provider value={usageQuotaContextValue}>
      <main className="flex h-screen min-w-[680px] flex-col overflow-hidden bg-background">
      <header
        style={dragRegionStyle}
        className="flex shrink-0 items-center border-b bg-background/80 backdrop-blur-md px-5 py-2.5 gap-4"
      >
        {/* Left: title */}
        <div className="shrink-0">
          <h1 className="text-xl font-semibold text-blue-500 dark:text-blue-400">auth-switch</h1>
          <p className="mono-label text-[10px] text-muted-foreground/60 leading-tight mt-0.5">{t("app.localOnly")}</p>
        </div>

        {/* Center: tab switch */}
        <div style={noDragRegionStyle} className="mx-auto flex rounded-lg border bg-muted/50 p-0.5 relative">
          <div
            className="absolute top-0.5 bottom-0.5 rounded-md bg-background shadow-sm transition-all duration-200 ease-out"
            style={{ left: pillStyle.left, width: pillStyle.width }}
          />
          <button
            type="button"
            ref={(el) => { tabRefs.current[0] = el; }}
            onClick={() => setActiveTab("codex")}
            className={cn(
              "relative z-10 rounded-md px-4 py-1 font-mono text-[11px] font-medium transition-colors duration-200",
              activeTab === "codex" ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
            )}
          >
            {t("tabs.codex")}
          </button>
          <button
            type="button"
            ref={(el) => { tabRefs.current[1] = el; }}
            onClick={() => setActiveTab("claude")}
            className={cn(
              "relative z-10 rounded-md px-4 py-1 font-mono text-[11px] font-medium transition-colors duration-200",
              activeTab === "claude" ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
            )}
          >
            {t("tabs.claude")}
          </button>
        </div>

        {/* Right: language + theme */}
        <div style={noDragRegionStyle} className="flex shrink-0 items-center gap-1.5">
          <div className="flex rounded-lg border bg-muted/40 p-0.5 overflow-hidden">
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-[11px] font-medium transition-colors duration-150",
                currentLang === "en"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground/70"
              )}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage("zh")}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-[11px] font-medium transition-colors duration-150",
                currentLang === "zh"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground/70"
              )}
            >
              中文
            </button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <CurrentAccountCard account={activeCurrent} app={activeTab} />

        {(error ?? notices[activeTab]) && (
          <div
            className={cn(
              "mt-4 rounded-lg border px-3.5 py-2.5 text-xs leading-5 shadow-sm",
              error ? "border-destructive/40 bg-destructive/10 text-destructive" : "bg-card text-muted-foreground"
            )}
          >
            {error && <AlertTriangle size={12} className="inline mr-1.5 mb-0.5" />}
            {error ?? notices[activeTab]}
          </div>
        )}

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="mono-label text-[10px] text-muted-foreground/70 tracking-wide">{t("app.accounts")}</h2>
            <div style={noDragRegionStyle} className="flex items-center gap-1.5">
              {activeTab === "codex" ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setApiProfileVisible(true)}
                    className="h-7 px-2.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {t("app.addApi")}
                  </Button>
                  <ImportButton
                    onImported={handleImported}
                    onError={showError}
                    onPasteJson={() => setPasteAuthJsonVisible(true)}
                  />
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setClaudeProfileVisible(true)}
                  className="h-7 px-2.5 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {t("app.addClaudeApi")}
                </Button>
              )}
            </div>
          </div>
          <AccountList
            accounts={activeAccounts}
            loading={loading}
            switchingId={switchingId}
            emptyKey={activeTab === "claude" ? "accountList.claudeEmpty" : "accountList.empty"}
            onSwitch={(account) => void handleSwitch(account)}
            onEdit={handleEditAccount}
            onRename={setRenameTarget}
            onDelete={(account) => void requestDelete(account)}
          />
        </section>
      </div>

      <footer className="shrink-0 border-t bg-background/80 backdrop-blur-sm px-5 py-2.5 font-mono text-[10px] text-muted-foreground/50 tracking-wide">
        {t("app.footer.local")} · {t("app.footer.db")}
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

      {(apiProfileVisible || editApiProfile) && (
        <ApiProfileDialog
          editAccount={editApiProfile ?? undefined}
          onCancel={() => {
            setApiProfileVisible(false);
            setEditApiProfile(null);
          }}
          onSave={(input) => {
            if (editApiProfile) {
              void handleUpdateApiProfile(input);
            } else {
              void handleCreateApiProfile(input);
            }
          }}
        />
      )}

      {(claudeProfileVisible || editClaudeProfile) && (
        <ClaudeProfileDialog
          editAccount={editClaudeProfile ?? undefined}
          onCancel={() => {
            setClaudeProfileVisible(false);
            setEditClaudeProfile(null);
          }}
          onSave={(input) => {
            if (editClaudeProfile) {
              void handleUpdateClaudeProfile(input);
            } else {
              void handleCreateClaudeProfile(input);
            }
          }}
        />
      )}

      {pasteAuthJsonVisible && (
        <PasteAuthJsonDialog
          onCancel={() => setPasteAuthJsonVisible(false)}
          onImported={(result) => {
            setPasteAuthJsonVisible(false);
            handleImported(result);
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
      </main>
    </UsageQuotaContext.Provider>
  );
}
