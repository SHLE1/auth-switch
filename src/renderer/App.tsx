import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { AlertTriangle, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getErrorMessage } from "../shared/errors";
import { authSwitch } from "./api/authSwitch";
import { setLanguage } from "./i18n/index";
import { useAccounts } from "./hooks/useAccounts";
import { useTheme } from "./hooks/useTheme";
import type { Account, ClaudeProfileInput, CodexApiProfileInput, ImportResult } from "../shared/types";
import { AccountList } from "./components/AccountList";
import { ApiProfileDialog } from "./components/ApiProfileDialog";
import { ClaudeProfileDialog } from "./components/ClaudeProfileDialog";
import { CurrentAccountCard } from "./components/CurrentAccountCard";
import { FirstRunDialog } from "./components/FirstRunDialog";
import { ImportButton } from "./components/ImportButton";
import { RenameDialog } from "./components/RenameDialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

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
  const [renameTarget, setRenameTarget] = useState<Account | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

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
          : t("notice.switchedTo", { name: account.name })
      );
      await refresh();
    } catch (error) {
      showError(getErrorMessage(error));
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleRename(name: string): Promise<void> {
    if (!renameTarget) return;
    try {
      await authSwitch.renameAccount(renameTarget.id, name);
      setRenameTarget(null);
      showNotice(t("notice.renamed", { name }));
      await refresh();
    } catch (error) {
      showError(getErrorMessage(error));
    }
  }

  async function handleDelete(account: Account): Promise<void> {
    try {
      await authSwitch.deleteAccount(account.id);
      showNotice(t("notice.deleted", { name: account.name }));
      await refresh();
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
      showNotice(t("notice.savedApiProfile", { name: result.account?.name ?? input.name }));
      await refresh();
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
      showNotice(t("notice.savedClaudeProfile", { name: result.account?.name ?? input.name }));
      await refresh();
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
      showNotice(t("notice.updatedApiProfile", { name: result.account?.name ?? input.name }));
      await refresh();
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
      showNotice(t("notice.updatedClaudeProfile", { name: result.account?.name ?? input.name }));
      await refresh();
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
        sameEmailNote
    );
    void refresh();
  }

  const currentLang = i18n.language.startsWith("zh") ? "zh" : "en";
  const dragRegionStyle = { WebkitAppRegion: "drag" } as CSSProperties;
  const noDragRegionStyle = { WebkitAppRegion: "no-drag" } as CSSProperties;
  const isMac = /Macintosh/.test(navigator.userAgent);
  const activeAccounts = activeTab === "claude" ? claudeAccounts : codexAccounts;
  const activeCurrent = activeTab === "claude" ? claudeCurrent : codexCurrent;

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background">
      {isMac && <div style={dragRegionStyle} className="h-8 w-full shrink-0" />}

      <header
        style={dragRegionStyle}
        className="flex shrink-0 items-center justify-between border-b bg-background px-4 py-2.5"
      >
        <div>
          <h1 className="text-sm font-semibold tracking-tight leading-tight">auth-switch</h1>
          <p className="mono-label text-[10px] text-muted-foreground leading-tight">{t("app.localOnly")}</p>
        </div>

        <div style={noDragRegionStyle} className="flex items-center gap-1.5">
          <div className="flex rounded-md border overflow-hidden">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLanguage("en")}
              className={cn(
                "h-7 rounded-none px-2.5 font-mono text-xs",
                currentLang === "en"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              EN
            </Button>
            <Separator orientation="vertical" className="h-7" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLanguage("zh")}
              className={cn(
                "h-7 rounded-none px-2.5 font-mono text-xs",
                currentLang === "zh"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              中文
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="size-7 text-muted-foreground"
          >
            {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div style={noDragRegionStyle} className="mb-4 flex rounded-md border overflow-hidden">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab("codex")}
            className={cn(
              "h-8 flex-1 rounded-none font-mono text-xs",
              activeTab === "codex" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
          >
            {t("tabs.codex")}
          </Button>
          <Separator orientation="vertical" className="h-8" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setActiveTab("claude")}
            className={cn(
              "h-8 flex-1 rounded-none font-mono text-xs",
              activeTab === "claude" ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
          >
            {t("tabs.claude")}
          </Button>
        </div>

        <CurrentAccountCard account={activeCurrent} app={activeTab} />

        {(error ?? notice) && (
          <div
            className={cn(
              "mt-3 border-l-2 pl-3 py-1.5 text-xs leading-5",
              error
                ? "border-destructive text-destructive"
                : "border-border text-muted-foreground"
            )}
          >
            {error && <AlertTriangle size={12} className="inline mr-1.5 mb-0.5" />}
            {error ?? notice}
          </div>
        )}

        <section className="mt-4">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="mono-label text-[10px] text-muted-foreground">{t("app.accounts")}</h2>
            <div style={noDragRegionStyle} className="flex items-center gap-1.5">
              {activeTab === "codex" ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setApiProfileVisible(true)}
                    className="h-7 px-2.5 font-mono text-xs text-muted-foreground"
                  >
                    {t("app.addApi")}
                  </Button>
                  <ImportButton onImported={handleImported} onError={showError} />
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setClaudeProfileVisible(true)}
                  className="h-7 px-2.5 font-mono text-xs text-muted-foreground"
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

      <footer className="shrink-0 border-t bg-background px-4 py-2 font-mono text-[10px] text-muted-foreground">
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
