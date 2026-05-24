import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { Account } from "../types";

interface CurrentAccountCardProps {
  account: Account | null;
}

export function CurrentAccountCard({ account }: CurrentAccountCardProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <section className="border-b pb-4">
      <p className="mono-label text-[10px] text-muted-foreground mb-2">
        {t("currentAccount.label")}
      </p>

      {account ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{account.name}</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground truncate">
              {account.kind === "api_key"
                ? account.base_url ?? t("currentAccount.apiProfile")
                : account.email ?? t("currentAccount.emailUnavailable")}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 font-mono text-[10px] mt-0.5">
            {account.kind === "api_key" ? "api key" : "auth.json"}
          </Badge>
        </div>
      ) : (
        <div>
          <p className="text-sm font-semibold text-muted-foreground">
            {t("currentAccount.noAccount")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("currentAccount.noAccountDesc")}
          </p>
        </div>
      )}
    </section>
  );
}
