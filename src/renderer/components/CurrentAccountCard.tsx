import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { Account } from "../../shared/types";

interface CurrentAccountCardProps {
  account: Account | null;
  app: "codex" | "claude";
}

export function CurrentAccountCard({ account, app }: CurrentAccountCardProps): JSX.Element {
  const { t } = useTranslation();
  const isClaude = app === "claude";

  return (
    <section className="border-b pb-4">
      <p className="mono-label text-[10px] text-muted-foreground mb-2">
        {t(isClaude ? "currentAccount.claudeLabel" : "currentAccount.label")}
      </p>

      {account ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{account.name}</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground truncate">
              {isClaude
                ? account.base_url ?? t("currentAccount.claudeOfficial")
                : account.kind === "api_key"
                  ? account.base_url ?? t("currentAccount.apiProfile")
                  : account.email ?? t("currentAccount.emailUnavailable")}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 font-mono text-[10px] mt-0.5">
            {isClaude ? "claude api" : account.kind === "api_key" ? "api key" : "auth.json"}
          </Badge>
        </div>
      ) : (
        <div>
          <p className="text-sm font-semibold text-muted-foreground">
            {t(isClaude ? "currentAccount.claudeNoAccount" : "currentAccount.noAccount")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t(isClaude ? "currentAccount.claudeNoAccountDesc" : "currentAccount.noAccountDesc")}
          </p>
        </div>
      )}
    </section>
  );
}
