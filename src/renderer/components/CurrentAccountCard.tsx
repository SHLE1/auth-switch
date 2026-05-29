import { useTranslation } from "react-i18next";
import type { Account } from "../../shared/types";
import { cn } from "@/lib/utils";
import { AccountUsageQuotaView } from "./AccountUsageQuotaView";

interface CurrentAccountCardProps {
  account: Account | null;
  app: "codex" | "claude";
}

export function CurrentAccountCard({ account, app }: CurrentAccountCardProps): JSX.Element {
  const { t } = useTranslation();
  const isClaude = app === "claude";

  return (
    <section className="mb-1">
      <p className="mono-label text-[10px] text-muted-foreground/70 mb-2">
        {t(isClaude ? "currentAccount.claudeLabel" : "currentAccount.label")}
      </p>

      <div
        className={cn(
          "relative overflow-hidden rounded-xl border p-3 transition-colors duration-200",
          account
            ? "border-blue-500/60 bg-card shadow-sm shadow-blue-500/10"
            : "border-border bg-card"
        )}
      >
        {/* Gradient overlay when there's an active account */}
        {account && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent pointer-events-none" />
        )}

        <div className="relative flex min-h-[3.75rem] items-center gap-3">
          {account ? (
            <>
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border font-mono text-base font-semibold",
                  account
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                {account.name.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-[180px] flex-1">
                <div className="flex items-center gap-2 min-h-[1.25rem]">
                  <p className="truncate text-sm font-semibold tracking-tight">{account.name}</p>
                  <span className="inline-flex items-center rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    {t("accountRow.current")}
                  </span>
                </div>
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {isClaude
                    ? account.base_url ?? t("currentAccount.claudeOfficial")
                    : account.kind === "api_key"
                      ? account.base_url ?? t("currentAccount.apiProfile")
                      : account.email ?? t("currentAccount.emailUnavailable")}
                </p>
              </div>
              {(app === "codex" || app === "claude") && <AccountUsageQuotaView account={account} inline />}
            </>
          ) : (
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t(isClaude ? "currentAccount.claudeNoAccount" : "currentAccount.noAccount")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {t(isClaude ? "currentAccount.claudeNoAccountDesc" : "currentAccount.noAccountDesc")}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
